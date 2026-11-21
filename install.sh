#!/bin/sh
# BeatNode installer for macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/jedgarf/BeatNode-Desktop/main/install.sh | sh
#
# Gets the newest release from GitHub, checks it against the release's SHA256SUMS.txt and installs it:
#   macOS   BeatNode.app into /Applications (or ~/Applications), Apple silicon only
#   Linux   the .deb on Debian/Ubuntu, otherwise the AppImage in your home folder (x64)
#
# BEATNODE_FORMAT=appimage skips the .deb:  curl ... | BEATNODE_FORMAT=appimage sh
#
# Everything runs from main() at the bottom so a cut-off download never runs half a script.

set -eu

REPO="jedgarf/BeatNode-Desktop"
BASE="https://github.com/$REPO/releases/latest/download"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
fail() {
  printf '\033[31mError:\033[0m %s\n' "$*" >&2
  exit 1
}
has() { command -v "$1" >/dev/null 2>&1; }

fetch() { # URL [FILE]
  if has curl; then
    if [ $# -gt 1 ]; then curl -fL --progress-bar -o "$2" "$1"; else curl -fsSL "$1"; fi
  elif has wget; then
    if [ $# -gt 1 ]; then wget -q --show-progress -O "$2" "$1"; else wget -qO- "$1"; fi
  else
    fail "curl or wget is needed to download BeatNode."
  fi
}

sha256_of() {
  if has sha256sum; then
    sha256sum "$1" | cut -d' ' -f1
  elif has shasum; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    fail "sha256sum or shasum is needed to check the download."
  fi
}

# picks the file in SHA256SUMS.txt whose name ends with $1, sets NAME, SUM and VERSION
pick() {
  line="$(printf '%s\n' "$SUMS" | grep -- "$1\$" | head -n 1)" || true
  [ -n "$line" ] || return 1
  SUM="${line%% *}"
  NAME="${line##* }"
  VERSION="$(printf '%s' "$NAME" | sed 's/^[^0-9]*\([0-9][0-9.]*[0-9]\).*/\1/')"
}

download() {
  bold "Downloading BeatNode $VERSION ($NAME)"
  FILE="$TMP/$NAME"
  fetch "$BASE/$NAME" "$FILE" || fail "The download failed."
  [ "$(sha256_of "$FILE")" = "$SUM" ] || fail "The download didn't match the published checksum, so it wasn't installed."
  info "Checksum verified."
}

install_mac() {
  if [ "$(uname -m)" != arm64 ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" != 1 ]; then
    fail "BeatNode for Mac is built for Apple silicon (M1 and newer) only."
  fi
  pick "-Installer.dmg" || fail "The newest release has no Mac download."
  download

  dest="${BEATNODE_APP_DIR:-/Applications}"
  [ -n "${BEATNODE_APP_DIR:-}" ] || [ -w "$dest" ] || dest="$HOME/Applications"
  mkdir -p "$dest"

  if pgrep -xq BeatNode 2>/dev/null; then
    info "Closing BeatNode to replace it..."
    osascript -e 'quit app "BeatNode"' >/dev/null 2>&1 || true
    sleep 2
  fi

  bold "Installing into $dest"
  mnt="$TMP/mnt"
  mkdir -p "$mnt"
  hdiutil attach -nobrowse -readonly -noautoopen -quiet -mountpoint "$mnt" "$FILE" || fail "Couldn't open the disk image."
  app="$(find "$mnt" -maxdepth 1 -name '*.app' | head -n 1)"
  if [ -z "$app" ]; then
    hdiutil detach -quiet "$mnt" || true
    fail "No app found in the disk image."
  fi
  rm -rf "$dest/BeatNode.app"
  ditto "$app" "$dest/BeatNode.app"
  hdiutil detach -quiet "$mnt" || true

  echo
  bold "BeatNode $VERSION is installed."
  info "Open it from $dest, Launchpad or Spotlight."
}

install_linux() {
  case "$(uname -m)" in
    x86_64 | amd64) ;;
    *) fail "BeatNode for Linux is built for 64-bit x86 only; this machine is $(uname -m)." ;;
  esac

  if [ "${BEATNODE_FORMAT:-}" != appimage ] && has apt-get && has dpkg && pick "-amd64.deb"; then
    install_deb
  else
    pick ".AppImage" || fail "The newest release has no Linux download."
    install_appimage
  fi
}

install_deb() {
  download
  # apt reads the file as its own user
  chmod 755 "$TMP"
  chmod 644 "$FILE"
  bold "Installing the .deb package (asks for your password)"
  if [ "$(id -u)" -eq 0 ]; then
    apt-get install -y "$FILE"
  elif has sudo; then
    sudo apt-get install -y "$FILE"
  else
    fail "Installing the .deb needs root. Run this as root, or use BEATNODE_FORMAT=appimage."
  fi

  echo
  bold "BeatNode $VERSION is installed."
  info "Open it from your app menu, or run: beatnode-desktop"
}

install_appimage() {
  download
  data="${XDG_DATA_HOME:-$HOME/.local/share}"
  dir="$data/beatnode"
  bin="$HOME/.local/bin"
  mkdir -p "$dir" "$bin" "$data/applications" "$data/icons/hicolor/512x512/apps"

  bold "Installing into $dir"
  cp "$FILE" "$dir/.BeatNode.AppImage.new"
  chmod 755 "$dir/.BeatNode.AppImage.new"
  mv -f "$dir/.BeatNode.AppImage.new" "$dir/BeatNode.AppImage"

  printf '#!/bin/sh\nexec "%s" "$@"\n' "$dir/BeatNode.AppImage" >"$bin/beatnode"
  chmod 755 "$bin/beatnode"

  fetch "https://raw.githubusercontent.com/$REPO/main/build/icon.png" "$data/icons/hicolor/512x512/apps/beatnode.png" 2>/dev/null || true
  cat >"$data/applications/beatnode.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=BeatNode
Comment=Your music and videos, in one place
Exec="$dir/BeatNode.AppImage" %U
Icon=beatnode
Terminal=false
Categories=AudioVideo;Audio;Video;Player;
StartupWMClass=BeatNode
EOF
  has update-desktop-database && update-desktop-database "$data/applications" >/dev/null 2>&1 || true

  echo
  bold "BeatNode $VERSION is installed."
  info "Open it from your app menu, or run: beatnode"
  case ":$PATH:" in
    *":$bin:"*) ;;
    *) info "(To run \"beatnode\" from a terminal, add $bin to your PATH.)" ;;
  esac
  if has ldconfig && ! ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'; then
    info "AppImages need FUSE 2. If BeatNode doesn't open, install it:"
    info "  Ubuntu 24.04+: sudo apt install libfuse2t64    Older Ubuntu/Debian: sudo apt install libfuse2"
  fi
}

cleanup() {
  if [ -d "$TMP/mnt" ] && has hdiutil; then hdiutil detach -quiet "$TMP/mnt" 2>/dev/null || true; fi
  rm -rf "$TMP"
}

main() {
  TMP="$(mktemp -d 2>/dev/null || mktemp -d -t beatnode)"
  trap cleanup EXIT INT TERM

  SUMS="$(fetch "$BASE/SHA256SUMS.txt")" || fail "Couldn't get the newest release's SHA256SUMS.txt from GitHub."

  case "$(uname -s)" in
    Darwin) install_mac ;;
    Linux) install_linux ;;
    *) fail "This installer is for macOS and Linux. On Windows, get BeatNode from https://github.com/$REPO/releases/latest" ;;
  esac
}

main "$@"
