# EarthLife promo.mp4 合成：blur 背景 + 遊戲置中 + 字幕 → xfade 串接
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\scenes

function Compose($src, $cap, $ss, $t, $out) {
  ffmpeg -y -v error -ss $ss -t $t -i $src -i $cap -filter_complex `
    "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=30,eq=brightness=-0.18[bg];[0:v]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0[base];[base][1:v]overlay=0:0,fps=30,format=yuv420p[v]" `
    -map "[v]" -c:v libx264 -crf 17 -preset medium $out
  Write-Host "done $out"
}

# 卡片段（靜態 → 影片）
ffmpeg -y -v error -loop 1 -framerate 30 -t 3 -i card_title.png -vf "format=yuv420p" -c:v libx264 -crf 17 seg0.mp4
ffmpeg -y -v error -loop 1 -framerate 30 -t 4 -i card_end.png -vf "format=yuv420p" -c:v libx264 -crf 17 seg6.mp4

Compose s1_start.webm  cap_s1.png 0.3 4.5 seg1.mp4
Compose s2_birth.webm  cap_s2.png 1.2 6   seg2.mp4
Compose s3_events.webm cap_s3.png 1.5 12  seg3.mp4
Compose s4_death.webm  cap_s4.png 4.5 10  seg4.mp4
Compose s5_coll.webm   cap_s5.png 0.5 8   seg5.mp4

# xfade 串接（fade 0.5s）：時長 3,4.5,6,12,10,8,4 → offsets 2.5,6.5,12,23.5,33,40.5
ffmpeg -y -v error -i seg0.mp4 -i seg1.mp4 -i seg2.mp4 -i seg3.mp4 -i seg4.mp4 -i seg5.mp4 -i seg6.mp4 -filter_complex `
  "[0][1]xfade=transition=fade:duration=0.5:offset=2.5[v1];[v1][2]xfade=transition=fade:duration=0.5:offset=6.5[v2];[v2][3]xfade=transition=fade:duration=0.5:offset=12[v3];[v3][4]xfade=transition=fade:duration=0.5:offset=23.5[v4];[v4][5]xfade=transition=fade:duration=0.5:offset=33[v5];[v5][6]xfade=transition=fade:duration=0.5:offset=40.5,format=yuv420p[v]" `
  -map "[v]" -c:v libx264 -crf 19 -preset medium -movflags +faststart ..\promo.mp4

ffprobe -v error -show_entries format=duration -of csv=p=0 ..\promo.mp4
Write-Host "PROMO DONE"
