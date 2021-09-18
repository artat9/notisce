package main

import (
	"context"
	"notisce/lib/functions/lib"
	"notisce/lib/functions/lib/common/log"
	"notisce/lib/functions/lib/infrastructure/ssm"
	"notisce/lib/functions/lib/subscribe"
	repository "notisce/lib/functions/lib/subscribe/persistence"
	"os"
)

func main() {
	ctx := context.Background()
	app, err := newApp(ctx)
	if err != nil {
		os.Exit(1)
	}
	if err := app.StartSubscription(ctx); err != nil {
		log.Error("an error occured", err)
	}

	os.Exit(1)
}

func newApp(ctx context.Context) (subscribe.Subscriber, error) {
	parameterstore := ssm.New()
	sender, err := lib.Slackcli(ctx, parameterstore)
	if err != nil {
		log.Error("initialize sender failed", err)
		return subscribe.Subscriber{}, err
	}
	return subscribe.NewSubscriber(ctx, parameterstore, sender, repository.New())
}
