import { IPodSize } from "../config.interface";
import { PodSize } from "./podsize";

const mockPodSize: IPodSize = {
	name: "small",
	description: "Small pod",
	default: true,
	active: true,
	resources: {
		requests: {
			memory: "256Mi",
			cpu: "250m",
		},
		limits: {
			memory: "512Mi",
			cpu: "500m",
		},
	},
};

describe("PodSize", () => {
	it("should be defined", () => {
		expect(new PodSize(mockPodSize)).toBeDefined();
	});
});
