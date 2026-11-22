package com.vibrations.visualiser.audio

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns

/** Owns the active audio source (none / track / mic), the analyser and the recording ring. */
class AudioEngine(private val context: Context) {
    enum class Source { AMBIENT, TRACK, MIC }

    interface Listener {
        fun onSourceChanged(source: Source, title: String?)
        fun onPlayStateChanged(playing: Boolean)
        fun onAudioError(message: String)
    }

    val analyzer = AudioAnalyzer()
    val recordRing = AudioRing()
    var listener: Listener? = null

    @Volatile var source = Source.AMBIENT; private set
    var trackTitle: String? = null; private set
    var trackUri: Uri? = null; private set

    @Volatile private var player: TrackPlayer? = null
    @Volatile private var mic: MicInput? = null
    private val main = Handler(Looper.getMainLooper())
    private var mono = FloatArray(4096)

    private val sink = PcmSink { pcm, frames, channels, rate, pos ->
        if (mono.size < frames) mono = FloatArray(frames)
        val inv = 1f / (32768f * channels)
        for (i in 0 until frames) {
            var s = 0
            for (c in 0 until channels) s += pcm[i * channels + c]
            mono[i] = s * inv
        }
        analyzer.process(mono, frames, pos)
        recordRing.write(pcm, frames, channels, rate)
    }

    val isPlaying: Boolean get() = player?.playing == true
    val durationUs: Long get() = player?.durationUs ?: 0L
    val positionUs: Long get() = player?.positionUs() ?: 0L
    var repeat: Boolean
        get() = player?.repeat ?: true
        set(v) { player?.repeat = v }

    fun loadTrack(uri: Uri) {
        stopAll()
        trackUri = uri
        trackTitle = readTitle(uri)
        val p = TrackPlayer(context, uri, sink, object : TrackPlayer.Listener {
            override fun onTrackReady(durationUs: Long) {}
            override fun onTrackRestarted(rate: Int) = analyzer.reset(rate)
            override fun onTrackEnded() { main.post { listener?.onPlayStateChanged(false) } }
            override fun onTrackError(message: String) {
                main.post {
                    listener?.onAudioError(message)
                    setAmbient()
                }
            }
        })
        player = p
        source = Source.TRACK
        p.start()
        listener?.onSourceChanged(source, trackTitle)
        listener?.onPlayStateChanged(true)
    }

    fun togglePlay() {
        val p = player ?: return
        if (!p.playing && p.durationUs > 0 && p.positionUs() >= p.durationUs - 50_000) p.seekTo(0)
        p.setPlaying(!p.playing)
        listener?.onPlayStateChanged(p.playing)
    }

    fun pause() {
        player?.let { if (it.playing) { it.setPlaying(false); listener?.onPlayStateChanged(false) } }
    }

    fun seekTo(us: Long) = player?.seekTo(us)

    fun startMic() {
        stopAll()
        analyzer.reset(MicInput.RATE)
        val m = MicInput(sink) { msg -> main.post { listener?.onAudioError(msg); setAmbient() } }
        mic = m
        source = Source.MIC
        m.start()
        listener?.onSourceChanged(source, null)
    }

    fun setAmbient() {
        stopAll()
        source = Source.AMBIENT
        listener?.onSourceChanged(source, null)
    }

    private fun stopAll() {
        player?.release(); player = null
        mic?.stop(); mic = null
        analyzer.reset(44100)
    }

    fun release() = stopAll()

    /** Called on the GL thread once per frame. */
    fun query(out: Features) {
        val p = player
        val m = mic
        when {
            p != null && p.playing -> analyzer.query(p.playbackFrame(), out)
            m != null -> analyzer.query(m.framesRead, out)
            else -> { out.active = false; out.kick = 0f }
        }
    }

    /** How far decoded audio runs ahead of what is heard, at 44.1 kHz. */
    fun latencyFrames44k(): Int = player?.latencyFrames44k() ?: 0

    private fun readTitle(uri: Uri): String {
        val mmr = MediaMetadataRetriever()
        val fromTags = runCatching {
            mmr.setDataSource(context, uri)
            val t = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)
            val a = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)
            if (!t.isNullOrBlank()) (if (!a.isNullOrBlank()) "$a — $t" else t) else null
        }.getOrNull()
        runCatching { mmr.release() }
        if (fromTags != null) return fromTags
        val name = runCatching {
            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
                if (it.moveToFirst()) it.getString(0) else null
            }
        }.getOrNull()
        return name?.substringBeforeLast('.') ?: "Track"
    }
}
