import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifySharedToken } from '../common/utils/webhook.util';

/** A separate scrape credential: application sessions never grant metrics access. */
@Injectable()
export class MetricsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const authorization = context.switchToHttp().getRequest()
      .headers.authorization;
    const token =
      typeof authorization === 'string'
        ? /^Bearer ([^\s]+)$/i.exec(authorization)?.[1]
        : undefined;
    if (!verifySharedToken(token, process.env.KUBERO_METRICS_TOKEN)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
