$input_json = [Console]::In.ReadToEnd() | ConvertFrom-Json
$file = $input_json.tool_input.file_path
if (-not $file) { exit 0 }

$ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
$formattable = @('.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.css')
if ($formattable -notcontains $ext) { exit 0 }

try {
    npx prettier --write "$file" 2>&1 | Out-Null

    $lintable = @('.ts', '.tsx', '.js', '.jsx')
    if ($lintable -contains $ext) {
        npx eslint --fix "$file" 2>&1 | Out-Null
    }
} catch {}

exit 0
