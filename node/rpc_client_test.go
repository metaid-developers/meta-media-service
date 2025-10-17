package node

import (
	"fmt"
	"testing"
)

func TestBasicAuth(t *testing.T) {
	username := "showpay"
	password := "showpay88.."
	fmt.Println(BasicAuth(username, password))
}

func TestGetDogeCurrentBlockHeight(t *testing.T) {
	height, err := CurrentBlockHeight("doge")
	if err != nil {
		t.Fatal(err)
	}
	fmt.Println(height)
}
