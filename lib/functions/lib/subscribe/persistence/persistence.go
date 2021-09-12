package subscriberep

import (
	"context"
	"notisce/lib/functions/lib/common/log"
	"notisce/lib/functions/lib/subscribe"

	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/guregu/dynamo"
)

type (
	// Repository repository
	Repository struct {
		ddb dynamo.DB
	}
)

// New new client
func New() Repository {
	return Repository{
		ddb: *dynamo.New(session.New()),
	}
}

// Subscribe register subscribe
func (r Repository) Subscribe(ctx context.Context, sub subscribe.Subscription) error {
	if err := r.ddb.Table(tableName()).Put(&sub).RunWithContext(ctx); err != nil {
		log.Error("put item failed", err)
		return err
	}
	return nil
}

// UnSubscribe delete subscribe
func (r Repository) UnSubscribe(ctx context.Context, in subscribe.Input) error {
	return nil
}

func tableName() string {
	return "notisce-main"
}
