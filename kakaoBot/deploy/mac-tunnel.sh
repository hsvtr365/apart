#!/bin/sh
set -eu
# OCI Tailscale IP only. Bind the local listener to loopback.
# Diagnostic only: npm start manages this tunnel itself. Do not run both.
exec ssh -N -o HostName=100.92.167.33 -o BatchMode=yes -o ConnectTimeout=10 -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -o ControlMaster=no -o ControlPath=none -L 127.0.0.1:28006:127.0.0.1:28004 oci-heartlink-db
