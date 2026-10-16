import { Global, Module } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Global()
@Module({
	providers: [AuditService, PrismaClient],
	controllers: [AuditController],
	exports: [AuditService],
})
export class AuditModule {}
