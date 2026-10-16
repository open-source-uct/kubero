import { Module } from "@nestjs/common";
import { AppsService } from "src/apps/apps.service";
import { RepoController } from "./repo.controller";
import { RepoService } from "./repo.service";

@Module({
	controllers: [RepoController],
	providers: [RepoService, AppsService],
})
export class RepoModule {}
