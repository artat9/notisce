import {
  ApiKeySourceType,
  IResource,
  LambdaIntegration,
  MockIntegration,
  PassthroughBehavior,
  RestApi,
} from "@aws-cdk/aws-apigateway";
import { Effect, PolicyStatement } from "@aws-cdk/aws-iam";
import { Code, Function, Runtime, Tracing } from "@aws-cdk/aws-lambda";
import * as cdk from "@aws-cdk/core";
import { resolve } from "path";

export class RestApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // ApiGateway
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
    functions(this, ["subscribe"], api);
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

export function addCorsOptions(apiResource: IResource, allowedOrigin: string) {
  apiResource.addMethod(
    "OPTIONS",
    new MockIntegration({
      integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers":
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            "method.response.header.Access-Control-Allow-Origin": `'${allowedOrigin}'`,
            "method.response.header.Access-Control-Allow-Credentials":
              "'false'",
            "method.response.header.Access-Control-Allow-Methods":
              "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    }
  );
}
const code = (dirname: string) => {
  return Code.fromAsset(
    resolve(`${__dirname}/../`, "lib", "functions", dirname, "bin", "main.zip")
  );
};
