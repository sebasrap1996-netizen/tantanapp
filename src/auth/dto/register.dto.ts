import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

// Validación actualizada: mínimo 6 caracteres, sin requisitos de números ni símbolos
export class RegisterDto {
  @IsString({ message: 'El nombre completo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre completo es requerido' })
  @MinLength(2, { message: 'El nombre completo debe tener al menos 2 caracteres' })
  fullName: string;

  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
