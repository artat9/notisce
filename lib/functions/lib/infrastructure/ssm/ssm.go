package ssm

import (
	"context"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ssm"
	"github.com/aws/aws-sdk-go/service/ssm/ssmiface"
	"github.com/ethereum/go-ethereum/log"
)

type (
	// Client ssm client
	Client struct {
		svc ssmiface.SSMAPI
	}
	// Key key
	Key string
)

const (
	infuraKeyPrefix = "notisce-infura-key-"
)

func keyOf(network string) string {
	return infuraKeyPrefix + network
}

// New New client
func New() Client {
	sess, _ := session.NewSessionWithOptions(session.Options{
		Config:  aws.Config{Region: aws.String("us-east-1")},
		Profile: "default",
	})
	return Client{
		svc: ssm.New(sess),
	}
}

// WsEndpoint get ws endpoint
func (c Client) WsEndpoint(ctx context.Context, network string) (val string, err error) {
	return c.get(ctx, keyOf(network))
}

// Get get parameter
func (c Client) get(ctx context.Context, key string) (val string, err error) {
	out, err := c.svc.GetParameterWithContext(ctx, &ssm.GetParameterInput{
		Name:           aws.String(key),
		WithDecryption: aws.Bool(true),
	})
	if err != nil {
		log.Error("ssm get parameter failed", err)
		return
	}
	return *out.Parameter.Value, nil
}
