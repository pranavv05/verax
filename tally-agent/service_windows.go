//go:build windows

package main

import (
	"context"
	"fmt"
	"time"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

const serviceName = "VeraxTallyAgent"

func isService() bool {
	ok, err := svc.IsWindowsService()
	return err == nil && ok
}

type winService struct{ cfgPath string }

func (s *winService) Execute(_ []string, req <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	status <- svc.Status{State: svc.StartPending}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- runAgent(ctx, s.cfgPath, false) }()
	status <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}

	for {
		select {
		case c := <-req:
			switch c.Cmd {
			case svc.Interrogate:
				status <- c.CurrentStatus
			case svc.Stop, svc.Shutdown:
				// The agent finishes and reports any in-flight push first.
				status <- svc.Status{State: svc.StopPending, WaitHint: 120000}
				cancel()
				<-done
				return false, 0
			}
		case err := <-done:
			cancel()
			if err != nil {
				return false, 1 // non-zero exit → SCM recovery restarts us
			}
			return false, 0
		}
	}
}

func runAsService(cfgPath string) error { return svc.Run(serviceName, &winService{cfgPath: cfgPath}) }

func installService(exePath, cfgPath string) error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connecting to the Windows service manager (run as Administrator): %w", err)
	}
	defer m.Disconnect()
	if s, err := m.OpenService(serviceName); err == nil {
		s.Close()
		return fmt.Errorf("the %s service is already installed — run uninstall first to reinstall", serviceName)
	}
	s, err := m.CreateService(serviceName, exePath, mgr.Config{
		DisplayName:      "Verax Tally Agent",
		Description:      "Pushes approved vouchers from Verax into TallyPrime on this computer.",
		StartType:        mgr.StartAutomatic,
		DelayedAutoStart: true,
	}, "run", "--config", cfgPath)
	if err != nil {
		return fmt.Errorf("creating the service: %w", err)
	}
	defer s.Close()
	// Restart on crash: 10s, 30s, then every 60s; reset the count after a day.
	_ = s.SetRecoveryActions([]mgr.RecoveryAction{
		{Type: mgr.ServiceRestart, Delay: 10 * time.Second},
		{Type: mgr.ServiceRestart, Delay: 30 * time.Second},
		{Type: mgr.ServiceRestart, Delay: 60 * time.Second},
	}, 24*60*60)
	if err := s.Start(); err != nil {
		return fmt.Errorf("service installed but did not start: %w", err)
	}
	return nil
}

func uninstallService() error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connecting to the Windows service manager (run as Administrator): %w", err)
	}
	defer m.Disconnect()
	s, err := m.OpenService(serviceName)
	if err != nil {
		return fmt.Errorf("the %s service is not installed", serviceName)
	}
	defer s.Close()
	if st, err := s.Query(); err == nil && st.State != svc.Stopped {
		_, _ = s.Control(svc.Stop)
		for i := 0; i < 60; i++ {
			if st, err := s.Query(); err != nil || st.State == svc.Stopped {
				break
			}
			time.Sleep(time.Second)
		}
	}
	return s.Delete()
}
