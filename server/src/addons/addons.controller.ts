import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation } from "@nestjs/swagger";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { JwtAuthGuard } from "../auth/strategies/jwt.guard";
import { OKDTO } from "../common/dto/ok.dto";
import type { AddonsService } from "./addons.service";

@Controller({ path: "api/addons", version: "1" })
export class AddonsController {
	constructor(private readonly addonsService: AddonsService) {}

	@ApiOperation({ summary: "Get a list of all addons" })
	@Get("/")
	@UseGuards(JwtAuthGuard, PermissionsGuard)
	@Permissions("app:read", "app:write")
	@ApiForbiddenResponse({
		description: "Error: Unauthorized",
		type: OKDTO,
		isArray: false,
	})
	@ApiBearerAuth("bearerAuth")
	async getAddons() {
		return this.addonsService.getAddonsList();
	}

	@ApiOperation({ summary: "Get a list of all operators" })
	@Get("/operators")
	@UseGuards(JwtAuthGuard, PermissionsGuard)
	@Permissions("app:read", "app:write")
	@ApiForbiddenResponse({
		description: "Error: Unauthorized",
		type: OKDTO,
		isArray: false,
	})
	@ApiBearerAuth("bearerAuth")
	async getOperators() {
		return this.addonsService.getOperatorsList();
	}
}
