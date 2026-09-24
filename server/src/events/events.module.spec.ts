import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { IdentityService } from '../auth/identity.service';

// El gateway autentica sockets con el JWT y la identidad de la BD; el cableado
// completo con AuthModule se comprueba al arrancar la aplicación.
describe('EventsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        EventsGateway,
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: IdentityService, useValue: { resolve: jest.fn() } },
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide EventsGateway', () => {
    const gateway = module.get<EventsGateway>(EventsGateway);
    expect(gateway).toBeDefined();
  });
});
