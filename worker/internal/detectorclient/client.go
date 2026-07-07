// Package detectorclient talks to the Python detector sidecar's HTTP contract
// documented in docs/EVENT_FORMAT.md ("Detector HTTP contract").
package detectorclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"vms-worker/internal/events"
)

type Client struct {
	baseURL string
	http    *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		http:    &http.Client{Timeout: 5 * time.Second},
	}
}

type detectResponse struct {
	Detections []events.Detection `json:"detections"`
}

func (c *Client) Detect(ctx context.Context, jpeg []byte) ([]events.Detection, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("frame", "frame.jpg")
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(jpeg); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/detect", &body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("detector returned status %d", res.StatusCode)
	}

	var parsed detectResponse
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	return parsed.Detections, nil
}

func (c *Client) DetectWithAnnotation(ctx context.Context, jpeg []byte) ([]events.Detection, []byte, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("frame", "frame.jpg")
	if err != nil {
		return nil, nil, err
	}
	if _, err := part.Write(jpeg); err != nil {
		return nil, nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, nil, err
	}

	url := c.baseURL + "/detect?annotate=true"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &body)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	res, err := c.http.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("detector returned status %d", res.StatusCode)
	}

	annotatedImage, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, nil, err
	}

	return nil, annotatedImage, nil
}
