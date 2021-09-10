import * as cdk from "@aws-cdk/core";
import { RestApiStack } from "../lib/restapi";

const app = new cdk.App();
new RestApiStack(app, "notisce-restapi", {});
