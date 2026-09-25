import { createApp } from './app.js';
import { configuration } from './config.js';
const app=await createApp();
const config=configuration();
await app.listen(config.port,config.host);
