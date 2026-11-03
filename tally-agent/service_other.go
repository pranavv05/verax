//go:build !windows

package main

import (
	"errors"
)

var errWindowsOnly = errors.New("installing as a service is only supported on Windows; use `run` instead")

func isService() bool                     { return false }
func runAsService(string) error           { return errWindowsOnly }
func installService(string, string) error { return errWindowsOnly }
func uninstallService() error             { return errWindowsOnly }
