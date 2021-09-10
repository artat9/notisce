import {
  AttributeType,
  BillingMode,
  Table,
  TableProps,
} from "@aws-cdk/aws-dynamodb";
import * as cdk from "@aws-cdk/core";

export class DatasourceStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const tablename = "notisce-main";
    new Table(this, "notisce-table", ddbProps(tablename));
  }
}

const ddbProps = (tableName: string): TableProps => {
  return {
    tableName: tableName,
    partitionKey: {
      name: `PK`,
      type: AttributeType.STRING,
    },
    sortKey: {
      name: `SK`,
      type: AttributeType.STRING,
    },
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    pointInTimeRecovery: true,
  };
};
