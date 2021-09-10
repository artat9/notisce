package subscribe

import "context"

type (
	// Service service
	Service struct {
		resolver EndpointResolver
	}

	// EndpointResolver resolver
	EndpointResolver interface {
		WsEndpoint(ctx context.Context, network string) (val string, err error)
	}
)

// New New Service
func New(resolver EndpointResolver) Service {
	return Service{
		resolver: resolver,
	}
}
