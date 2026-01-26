#!/bin/bash
set -e

ssh tinkertanker@dev.tk.sg 'cd Docker/hr-onboarder-talenox && git pull && docker compose up -d --build'
