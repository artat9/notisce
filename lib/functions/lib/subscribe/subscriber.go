package subscribe

import (
	"context"
	"notisce/lib/functions/lib/common/log"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

const (
	rinkebyScanBaseURL = "https://rinkeby.etherscan.io/address/"
)

type (

	// Subscriber subscriber
	Subscriber struct {
		endpoint   wsEndpoint
		repository Repository
		resolver   AbiResolver
		sender     MsgSender
	}

	Event struct {
		BlockNumber     uint64
		EventName       string
		ContractAddress string
		TxHash          string
		Parameters      map[string]interface{}
	}

	// MsgSender sender
	MsgSender interface {
		Send(ctx context.Context, event Event, subscription Subscription) error
	}

	wsEndpoint struct {
		rinkeby string
	}

	// Repository repository
	Repository interface {
		Subscribing(ctx context.Context) ([]Subscription, error)
		SubscribingFrom(ctx context.Context, t time.Time) ([]Subscription, error)
	}

	// AbiResolver abi resolver
	AbiResolver interface {
		Resolve(ctx context.Context, url string) (abi.ABI, error)
	}

	// EndpointResolver resolver
	EndpointResolver interface {
		WsEndpoint(ctx context.Context, network string) (val string, err error)
	}

	// Subscription subscription
	Subscription struct {
		Address    string    `dynamo:"PK"`
		EventName  string    `dynamo:"SK"`
		Event      abi.Event `dynamo:"Event"`
		Timestamp  time.Time `dynamo:"Timestamp"`
		Network    string    `dynamo:"Network"`
		WebhookURL string    `dynamo:"WebhookUrl"`
		Abi        abi.ABI   `dynamo:"Abi"`
		ChannelID  string    `dynamo:"ChannelId"`
	}
)

// NewSubscriber new subscriber
func NewSubscriber(ctx context.Context, resolver EndpointResolver, sender MsgSender, repository Repository) (Subscriber, error) {
	rinkeby, err := resolver.WsEndpoint(ctx, NetworkRinkeby)
	if err != nil {
		log.Error("cannot resolve endpoint rinkeby", err)
	}
	return Subscriber{
		endpoint: wsEndpoint{
			rinkeby: rinkeby,
		},
		repository: repository,
		sender:     sender,
	}, err
}

func resolveEndpoint(ctx context.Context, resolver EndpointResolver) (wsEndpoint, error) {
	rinkeby, err := resolver.WsEndpoint(ctx, NetworkRinkeby)
	return wsEndpoint{
		rinkeby: rinkeby,
	}, err
}

// ScanURLByNetwork scan url
func ScanURLByNetwork(network, address string) string {
	if network == NetworkRinkeby {
		return rinkebyScanBaseURL + address
	}
	return ""
}
func newSubscription(input Input, contract abi.ABI) (Subscription, error) {
	ev, err := toEvent(input.Event, contract)
	if err != nil {
		return Subscription{}, err
	}
	return Subscription{
		Address:    input.Address,
		EventName:  input.Event,
		Event:      ev,
		Network:    input.Network,
		Abi:        contract,
		Timestamp:  time.Now(),
		WebhookURL: input.WebhookURL,
		ChannelID:  input.ChannelID,
	}, nil
}

// StartSubscription start subscription
func (s Subscriber) StartSubscription(ctx context.Context) error {
	subs, err := s.loadAllSubscriptions(ctx)
	if err != nil {
		return err
	}
	s.startSubscriptions(ctx, subs)
	return nil
}

func (s Subscriber) startSubscriptions(ctx context.Context, subs []Subscription) {
	var wg sync.WaitGroup
	for i := 0; i < len(subs); i++ {
		wg.Add(1)
		sub := subs[i]
		log.Info("start subscription event " + sub.Event.RawName + " of " + sub.Address)
		go s.startSubscriptionOf(ctx, sub)
	}
	wg.Wait()
}

func (s Subscriber) startSubscriptionOf(ctx context.Context, subscription Subscription) error {
	client, err := ethclient.Dial(s.endpoint.rinkeby)
	if err != nil {
		log.Error("rinkeby not supported", err)
		return err
	}
	address := common.HexToAddress(subscription.Address)
	query := ethereum.FilterQuery{
		Addresses: []common.Address{address},
		Topics:    [][]common.Hash{{subscription.Event.ID}},
	}
	logs := make(chan types.Log)
	sub, err := client.SubscribeFilterLogs(context.Background(), query, logs)
	if err != nil {
		log.Error("cant subscribe events", err)
	}
	for {
		select {
		case err := <-sub.Err():
			log.Error("unexpected error occured: ", err)
		case vLog := <-logs:
			if err := s.sender.Send(ctx, newEvent(vLog, subscription), subscription); err != nil {
				log.Error("msg send failed:", err)
			}
		}
	}
}

func newEvent(vLog types.Log, subscription Subscription) Event {
	var mp map[string]interface{} = map[string]interface{}{}
	subscription.Abi.UnpackIntoMap(mp, subscription.Event.RawName, vLog.Data)
	return Event{
		BlockNumber:     vLog.BlockNumber,
		ContractAddress: vLog.Address.String(),
		EventName:       subscription.EventName,
		TxHash:          vLog.TxHash.String(),
		Parameters:      mp,
	}
}

func (s Subscriber) loadAllSubscriptions(ctx context.Context) ([]Subscription, error) {
	return s.repository.Subscribing(ctx)
}
