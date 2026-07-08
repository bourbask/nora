# Auto-sync scheduling (systemd user timer)

Non-interactive import of provider exports three times a day.
The interactive provider scrape (e.g. 2FA) stays manual — the timer only converts + imports what's
waiting and nudges you (`notify-send`) when a fresh scrape is due.

## Install

```sh
DIR="$(cd "$(dirname "$0")/../.." && pwd)"   # repo root
mkdir -p ~/.config/systemd/user
sed "s#__PROJECT_DIR__#$DIR#" scripts/systemd/firefly-autosync.service \
    > ~/.config/systemd/user/firefly-autosync.service
cp scripts/systemd/firefly-autosync.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now firefly-autosync.timer
```

Check: `systemctl --user list-timers firefly-autosync.timer` ·
run once now: `systemctl --user start firefly-autosync.service` ·
logs: `journalctl --user -u firefly-autosync.service`.

`notify-send` needs the graphical session, so keep the timer under the user manager
(not system cron). `Persistent=true` catches up a run missed while the PC was off.

## Monthly snapshot capture

Same install pattern as auto-sync, substituting the project dir:

```sh
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
sed "s#__PROJECT_DIR__#$DIR#" scripts/systemd/nora-snapshot.service \
    > ~/.config/systemd/user/nora-snapshot.service
cp scripts/systemd/nora-snapshot.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now nora-snapshot.timer
```

First run, backfill history once: `./.venv/bin/python scripts/capture-snapshot.py --backfill 12`.
