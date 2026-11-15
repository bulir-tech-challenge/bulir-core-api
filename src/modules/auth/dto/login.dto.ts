import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * O utilizador entra com e-mail ou NIF (ambos únicos).
 *
 * `identifier` é o campo principal. `email` continua aceite como alias
 * para não quebrar clientes que já o usavam; basta enviar um dos dois.
 */
export class LoginDto {
  @ValidateIf((dto: LoginDto) => dto.email === undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  identifier?: string;

  @ValidateIf((dto: LoginDto) => dto.identifier === undefined)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
