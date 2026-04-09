import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    // Si hay error o no hay usuario, continuamos sin autenticación
    // Esto permite que el endpoint funcione con o sin token
    return user;
  }
}
