import 'reflect-metadata';
import { ArgumentsHost, Catch, Controller, ExceptionFilter, Get, HttpException, Inject, Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Database } from './database.js';
import { AuthController, AuthService, SessionGuard } from './auth.js';
import { PlatformController, PlatformService } from './platform.js';
import { configuration } from './config.js';

@Controller('health')
class HealthController {
  constructor(@Inject(Database) private readonly db:Database) {}
  @Get() async health() { await this.db.query('SELECT 1'); return { status:'ok' }; }
}
@Catch()
class SafeErrors implements ExceptionFilter {
  catch(error: any, host:ArgumentsHost) {
    const response=host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) response.status(error.getStatus()).json(error.getResponse());
    else if (error?.code==='23505') response.status(409).json({message:'Conflicting or duplicate operation'});
    else response.status(500).json({message:'Request could not be completed'});
  }
}
@Module({ controllers:[AuthController,PlatformController,HealthController], providers:[Database,AuthService,SessionGuard,PlatformService] })
export class AppModule {}

export async function createApp() {
  const config=configuration();
  const app=await NestFactory.create<NestExpressApplication>(AppModule,{logger:config.production?['error','warn']:['error','warn','log']});
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({origin:config.origin,credentials:true,allowedHeaders:['Content-Type','Idempotency-Key'],methods:['GET','POST']});
  const counters=new Map<string,{count:number;until:number}>();
  app.use((req:Request,res:Response,next:NextFunction) => {
    res.setHeader('Cache-Control','no-store');
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin!==config.origin) return res.status(403).json({message:'Origin not allowed'});
    const now=Date.now();
    if(counters.size>1000) for(const [key,value] of counters) if(value.until<now) counters.delete(key);
    const key=req.ip || 'unknown';
    let counter=counters.get(key);
    if(!counter || counter.until<now) {counter={count:0,until:now+60000};counters.set(key,counter);}
    if(++counter.count>300) return res.status(429).json({message:'Too many requests'});
    next();
  });
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true,transformOptions:{enableImplicitConversion:false}}));
  app.useGlobalFilters(new SafeErrors());
  app.enableShutdownHooks();
  return app;
}
