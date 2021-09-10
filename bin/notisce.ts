import * as cdk from "@aws-cdk/core";
import { DatasourceStack } from "../lib/datasource";
import { RestApiStack } from "../lib/restapi";

const app = new cdk.App();
new DatasourceStack(app, "notisce-datasource", {});
new RestApiStack(app, "notisce-restapi", {});
