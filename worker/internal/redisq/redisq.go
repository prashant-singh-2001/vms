// Package redisq wraps the Redis Streams used as the message queue between
// the api and the worker. See docs/EVENT_FORMAT.md for the stream/field layout.
package redisq

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"vms-worker/internal/events"
)

const (
	StreamCommands = "camera:commands"
	StreamEvents   = "detection:events"
	StreamStats    = "camera:stats"
	GroupWorkers   = "workers"
)

func NewClient(url string) (*redis.Client, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	return redis.NewClient(opt), nil
}

func ensureGroup(ctx context.Context, client *redis.Client, stream, group string) error {
	err := client.XGroupCreateMkStream(ctx, stream, group, "$").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return err
	}
	return nil
}

type CommandHandler func(cmd events.CameraCommand)

// ConsumeCommands blocks, reading camera:commands via a consumer group so
// multiple worker replicas can share the load, and invokes handle for each
// command. It only returns when ctx is cancelled or a non-recoverable error
// occurs.
func ConsumeCommands(ctx context.Context, client *redis.Client, consumerName string, handle CommandHandler) error {
	if err := ensureGroup(ctx, client, StreamCommands, GroupWorkers); err != nil {
		return fmt.Errorf("ensure group: %w", err)
	}

	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		res, err := client.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    GroupWorkers,
			Consumer: consumerName,
			Streams:  []string{StreamCommands, ">"},
			Count:    20,
			Block:    5 * time.Second,
		}).Result()

		if errors.Is(err, redis.Nil) {
			continue
		}
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			log.Printf("[redis] command consumer error, retrying in 2s: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		for _, stream := range res {
			for _, msg := range stream.Messages {
				cmd := events.CameraCommand{
					Action:   fmt.Sprint(msg.Values["action"]),
					CameraID: fmt.Sprint(msg.Values["cameraId"]),
					RtspURL:  fmt.Sprint(msg.Values["rtspUrl"]),
				}
				handle(cmd)
				client.XAck(ctx, StreamCommands, GroupWorkers, msg.ID)
			}
		}
	}
}

func PublishEvent(ctx context.Context, client *redis.Client, event events.PersonDetectedEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return client.XAdd(ctx, &redis.XAddArgs{
		Stream: StreamEvents,
		Values: map[string]interface{}{"event": string(payload)},
	}).Err()
}

func PublishStats(ctx context.Context, client *redis.Client, stats events.StatsPayload) error {
	return client.XAdd(ctx, &redis.XAddArgs{
		Stream: StreamStats,
		MaxLen: 10000,
		Approx: true,
		Values: map[string]interface{}{
			"cameraId":            stats.CameraID,
			"fps":                 strconv.FormatFloat(stats.FPS, 'f', 2, 64),
			"detectionsPerMinute": strconv.FormatFloat(stats.DetectionsPerMinute, 'f', 2, 64),
			"state":               string(stats.State),
			"timestamp":           stats.Timestamp,
		},
	}).Err()
}
