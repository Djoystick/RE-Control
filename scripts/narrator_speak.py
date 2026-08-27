import asyncio, sys, os, tempfile, subprocess

sys.path.insert(0, r'H:\Work\RE_Control\scripts\edge_tts_pkg')
import edge_tts

async def main():
    text = sys.argv[1] if len(sys.argv) > 1 else 'Тест'
    tmp = tempfile.mktemp(suffix='.mp3')
    
    communicate = edge_tts.Communicate(text, 'ru-RU-DmitryNeural', rate='-10%', pitch='-5Hz')
    await communicate.save(tmp)
    
    # Estimate duration: ~65ms per char, min 3 sec
    sleep_ms = max(3000, len(text) * 65)
    tmp_fwd = tmp.replace(os.sep, '/')
    
    ps = (
        f"Add-Type -AssemblyName PresentationCore; "
        f"$p = New-Object System.Windows.Media.MediaPlayer; "
        f"$p.Open([System.Uri]'file:///{tmp_fwd}'); "
        f"$p.Play(); "
        f"Start-Sleep -Milliseconds {sleep_ms}; "
        f"$p.Close()"
    )
    subprocess.run(['powershell', '-NoProfile', '-Command', ps])
    try:
        os.unlink(tmp)
    except:
        pass

asyncio.run(main())
