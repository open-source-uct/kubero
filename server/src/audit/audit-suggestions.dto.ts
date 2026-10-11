import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AuditSuggestionsDto {
  @IsIn(['pipeline', 'username'])
  kind: 'pipeline' | 'username' = 'pipeline';

  @IsOptional()
  @IsString()
  @MaxLength(253)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  pipeline?: string;
}
