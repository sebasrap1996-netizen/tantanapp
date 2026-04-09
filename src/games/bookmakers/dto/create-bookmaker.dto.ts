import { IsString, IsNumber, IsOptional, IsBoolean, IsObject, MinLength, IsUrl } from 'class-validator';

export class CreateBookmakerDto {
  @IsNumber()
  gameId: number;

  @IsString()
  @MinLength(2, { message: 'El nombre del bookmaker debe tener al menos 2 caracteres' })
  bookmaker: string;

  @IsString()
  bookmakerImg: string;

  @IsOptional()
  @IsString()
  urlWebsocket?: string;

  @IsOptional()
  @IsString()
  apiMessage?: string;

  @IsOptional()
  @IsString()
  authMessage?: string;

  @IsOptional()
  @IsString()
  pingMessage?: string;

  @IsOptional()
  @IsString()
  casinoDomain?: string;

  @IsOptional()
  @IsNumber()
  scaleImg?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
