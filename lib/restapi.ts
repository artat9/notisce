import {
  ApiKeySourceType,
  LambdaIntegration,
  RestApi,
} from "@aws-cdk/aws-apigateway";
import { Effect, PolicyStatement } from "@aws-cdk/aws-iam";
import { Code, Function, Runtime, Tracing } from "@aws-cdk/aws-lambda";
import * as cdk from "@aws-cdk/core";
import { resolve } from "path";

export class RestApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const api = new RestApi(this, "RestApi", {
      restApiName: "claime-api",
      apiKeySourceType: ApiKeySourceType.HEADER,
    });
    const apiKey = api.addApiKey("APIKey", {
      apiKeyName: "claime",
    });
    api
      .addUsagePlan("UsagePlanForAPIKey", {
        apiKey: apiKey,
      })
      .addApiStage({
        stage: api.deploymentStage,
      });
    functions(this, ["subscribe", "unsubscribe"], api);
  }
}

const functions = (scope: cdk.Construct, resources: string[], api: RestApi) => {
  return resources.map((r) => {
    const resource = api.root.addResource(r);
    const func = new Function(scope, r, {
      functionName: r,
      code: code(r),
      handler: "bin/main",
      timeout: cdk.Duration.minutes(1),
      runtime: Runtime.GO_1_X,
      tracing: Tracing.ACTIVE,
    });
    func.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["lambda:*"],
        resources: ["*"],
      })
    );
    resource.addMethod("PUT", new LambdaIntegration(func));
    return resource;
  });
};

const code = (dirname: string) => {
  return Code.fromAsset(
    resolve(`${__dirname}/../`, "lib", "functions", dirname, "bin", "main.zip")
  );
};
