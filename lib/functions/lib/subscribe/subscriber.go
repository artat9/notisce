package subscribe

import (
	"context"
	"errors"
	abiresolver "notisce/lib/functions/lib/infrastructure/abi"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

type (
	// Service service
	Service struct {
		resolver   EndpointResolver
		messenger  Messenger
		repository Repository
	}

	// Repository repository
	Repository interface {
		Subscribe(ctx context.Context, sub Subscription) error
		UnSubscribe(ctx context.Context, in Input) error
	}

	// EndpointResolver resolver
	EndpointResolver interface {
		WsEndpoint(ctx context.Context, network string) (val string, err error)
	}

	// Messenger messenger application
	Messenger interface {
		ToInputFromBody(body string) (Input, error)
		ErrorOutput(err error) Output
		ToOutput(in Input) Output
	}

	// Input input
	Input struct {
		Type       string
		Address    string
		Event      string
		Network    string
		AbiURL     string
		WebhookURL string
	}

	// Subscription subscription
	Subscription struct {
		Address    string    `dynamo:"PK"`
		Event      string    `dynamo:"SK"`
		Timestamp  time.Time `dynamo:"Timesamp"`
		Network    string    `dynamo:"Network"`
		WebhookURL string    `dynamo:"WebhookUrl"`
		Abi        abi.ABI
	}

	// Output output
	Output interface {
		Parse() ([]byte, error)
	}
)

const (
	// Subscribe subscribe
	Subscribe = "subscribe"
	// Unsubscribe unsubscribe
	Unsubscribe = "unsubscribe"
	// NetworkRinkeby rinkeby
	NetworkRinkeby     = "rinkeby"
	rinkebyScanBaseURL = "https://rinkeby.etherscan.io/address/"
)

// New New Service
func New(resolver EndpointResolver, messenger Messenger, repository Repository) Service {
	return Service{
		resolver:   resolver,
		messenger:  messenger,
		repository: repository,
	}
}

// ScanURLByNetwork scan url
func ScanURLByNetwork(network, address string) string {
	if network == NetworkRinkeby {
		return rinkebyScanBaseURL + address
	}
	return ""
}

var (
	// AllowedTypes allowed Types for subscription.
	AllowedTypes = []string{Subscribe, Unsubscribe}
	// SupportedNetworks supported networks
	SupportedNetworks = []string{NetworkRinkeby}
)

// validType is type valid
func validType(val string) bool {
	return valid(val, AllowedTypes)
}

func valid(val string, supported []string) bool {
	for _, s := range supported {
		if val == s {
			return true
		}
	}
	return false
}

// validNetwork is network supported
func validNetwork(val string) bool {
	return valid(val, SupportedNetworks)
}

// Process process request
func (s Service) Process(ctx context.Context, requestbody string) (Output, error) {
	input, err := s.messenger.ToInputFromBody(requestbody)
	if err != nil {
		return s.messenger.ErrorOutput(err), err
	}
	if err := input.validate(); err != nil {
		return s.messenger.ErrorOutput(err), nil
	}
	if input.Type == Subscribe {
		return s.subscribe(ctx, input)
	}
	return s.messenger.ErrorOutput(nil), err
}

func (s Service) subscribe(ctx context.Context, input Input) (Output, error) {
	abi, err := abiresolver.Resolver{}.Resolve(ctx, input.AbiURL)
	if err != nil {
		return s.messenger.ErrorOutput(err), err
	}
	if err := s.repository.Subscribe(ctx, newSubscription(input, abi)); err != nil {
		return s.messenger.ErrorOutput(err), err
	}
	return s.messenger.ToOutput(input), nil
}

func newSubscription(input Input, contract abi.ABI) Subscription {
	return Subscription{
		Address:    input.Address,
		Event:      input.Event,
		Network:    input.Network,
		Abi:        contract,
		Timestamp:  time.Now(),
		WebhookURL: input.WebhookURL,
	}
}

func (s Service) unbscribe(ctx context.Context, input Input) (string, error) {
	return "", nil
}

func (input Input) validate() error {
	if !validType(input.Type) {
		return errors.New("Subscription type is invalid. Allowed values:" + strings.Join(AllowedTypes, ", ") + ". Got:" + input.Type)
	}
	if !validNetwork(input.Network) {
		return errors.New("Not supported network. Allowed values:" + strings.Join(SupportedNetworks, ", ") + ". Got:" + input.Network)
	}
	if input.Address == "" {
		return missingRequiredFieldError("Address")
	}
	if !common.IsHexAddress(input.Address) {
		return errors.New("Contract address " + input.Address + " is not hex address. Example:" + "0xaE2b9f801963891fC1eD72F655De266A7ae34FE8.")
	}
	return nil
}

func missingRequiredFieldError(field string) error {
	return errors.New("Missing required field:" + field)
}
