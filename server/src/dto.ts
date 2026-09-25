import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDefined, IsObject, IsIn, IsInt, ValidateIf, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class LocalizedText {
  @ValidateIf((_, v) => v !== undefined) @IsString() @MaxLength(4000) zh?: string;
  @ValidateIf((_, v) => v !== undefined) @IsString() @MaxLength(4000) en?: string;
  @ValidateIf((_, v) => v !== undefined) @IsString() @MaxLength(4000) ja?: string;
}
export class LocalizedTags {
  @ValidateIf((_, v) => v !== undefined) @IsArray() @ArrayMaxSize(20) @IsString({each:true}) @MaxLength(80,{each:true}) zh?: string[];
  @ValidateIf((_, v) => v !== undefined) @IsArray() @ArrayMaxSize(20) @IsString({each:true}) @MaxLength(80,{each:true}) en?: string[];
  @ValidateIf((_, v) => v !== undefined) @IsArray() @ArrayMaxSize(20) @IsString({each:true}) @MaxLength(80,{each:true}) ja?: string[];
}
export class CreateExperimentDto {
  @IsDefined() @IsObject() @ValidateNested() @Type(() => LocalizedText) title!: LocalizedText;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => LocalizedText) description!: LocalizedText;
  @IsObject() @ValidateNested() @Type(() => LocalizedText) required_items: LocalizedText = {};
  @IsArray() @ArrayMaxSize(20) @IsString({each:true}) @MaxLength(80,{each:true}) tags: string[] = [];
  @IsObject() @ValidateNested() @Type(() => LocalizedTags) tagsLocales: LocalizedTags = {};
  @IsIn(['online','offline']) location_type!: 'online'|'offline';
  @IsString() @MinLength(1) @MaxLength(2000) location_detail!: string;
  @IsInt() @Min(0) @Max(1000000) reward_points!: number;
  @IsInt() @Min(1) @Max(10080) duration_minutes!: number;
  @IsInt() @Min(0) @Max(100) min_reputation_required!: number;
  @IsInt() @Min(1) @Max(100000) capacity!: number;
}
export class RatingDto {
  @IsInt() @Min(-100) @Max(100) delta!: number;
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}
export class RedemptionDto { @IsInt() @Min(1000) @Max(1000000) amount!: number; }
