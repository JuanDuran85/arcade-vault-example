Add-Type -AssemblyName PresentationCore
$player = New-Object System.Windows.Media.MediaPlayer
$player.Open([Uri]"d:\code_repos\claude_code_examples\claudecode-finished.mp3")
$player.Play()
Start-Sleep -Milliseconds 500
while ($player.NaturalDuration.HasTimeSpan -and $player.Position -lt $player.NaturalDuration.TimeSpan) {
    Start-Sleep -Milliseconds 200
}
