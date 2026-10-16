import { Global, Module } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { DatabaseService } from "./database.service";

//DatabaseService.Init(); // configing the database connection initialization

@Global()
@Module({
	providers: [
		DatabaseService,
		{
			provide: PrismaClient,
			useValue: new PrismaClient(),
		},
	],
	exports: [DatabaseService, PrismaClient],
})
export class DatabaseModule {}
