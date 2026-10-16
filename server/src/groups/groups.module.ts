import { Module } from "@nestjs/common";
import { GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";

@Module({
	providers: [GroupsService],
	exports: [GroupsService],
	controllers: [GroupsController],
})
export class GroupModule {}
