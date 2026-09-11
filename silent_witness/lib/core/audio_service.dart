import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

/// Every sound in the game. All calls are fire-and-forget and swallow errors:
/// a device that cannot play audio must never break the round.
class AudioService {
  AudioService();

  static const String ambientAsset = 'audio/tick_loop.wav';
  static const String gavelAsset = 'audio/gavel.wav';
  static const String winAsset = 'audio/reveal_win.wav';
  static const String loseAsset = 'audio/reveal_lose.wav';
  static const String suspenseAsset = 'audio/suspense.wav';
  static const String clickAsset = 'audio/click.wav';

  final AudioPlayer _ambient = _newPlayer();
  final AudioPlayer _sfx = _newPlayer();

  bool _enabled = true;
  bool _ambientPlaying = false;
  bool _configured = false;

  bool get enabled => _enabled;

  Future<void> setEnabled(bool value) async {
    _enabled = value;
    if (!value) await stopAmbient();
  }

  Future<void> startAmbient() async {
    if (!_enabled || _ambientPlaying) return;
    _ambientPlaying = true;
    await _guard(() async {
      await _configure();
      await _ambient.setVolume(0.45);
      await _ambient.play(AssetSource(ambientAsset));
    });
  }

  Future<void> stopAmbient() async {
    if (!_ambientPlaying) return;
    _ambientPlaying = false;
    await _guard(_ambient.stop);
  }

  Future<void> pauseAmbient() async {
    if (!_ambientPlaying) return;
    await _guard(_ambient.pause);
  }

  Future<void> resumeAmbient() async {
    if (!_enabled || !_ambientPlaying) return;
    await _guard(_ambient.resume);
  }

  Future<void> click() => _play(clickAsset, volume: 0.5);

  Future<void> gavel() => _play(gavelAsset, volume: 1.0);

  Future<void> suspense() => _play(suspenseAsset, volume: 0.85);

  Future<void> reveal({required bool detectiveWon}) =>
      _play(detectiveWon ? winAsset : loseAsset, volume: 1.0);

  Future<void> _play(String asset, {double volume = 1.0}) async {
    if (!_enabled) return;
    await _guard(() async {
      await _configure();
      await _sfx.stop();
      await _sfx.setVolume(volume);
      await _sfx.play(AssetSource(asset));
    });
  }

  Future<void> dispose() async {
    await _guard(_ambient.dispose);
    await _guard(_sfx.dispose);
  }

  /// `AudioPlayer`'s constructor kicks off platform initialisation in the
  /// background, and nothing awaits it. On a device (or a test host) with no
  /// audio backend that failure would surface as an unhandled async error, so
  /// the player is built inside a guarded zone that keeps it in the log.
  static AudioPlayer _newPlayer() {
    late final AudioPlayer player;
    runZonedGuarded(
      () => player = AudioPlayer(),
      (error, _) => debugPrint('AudioService: player init failed — $error'),
    );
    return player;
  }

  /// Release modes are set on first use rather than in the constructor: on a
  /// device (or a test host) without an audio backend the plugin throws, and a
  /// throw from a constructor would take the whole round down with it.
  Future<void> _configure() async {
    if (_configured) return;
    await _ambient.setReleaseMode(ReleaseMode.loop);
    await _sfx.setReleaseMode(ReleaseMode.stop);
    // Only latched once both calls came back, so a transient failure early in
    // the app's life is retried on the next sound instead of sticking.
    _configured = true;
  }

  Future<void> _guard(Future<void> Function() action) async {
    try {
      await action();
    } catch (error) {
      // Emulators without an audio backend, muted devices, revoked focus …
      debugPrint('AudioService: $error');
    }
  }
}
