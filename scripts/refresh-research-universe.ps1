$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
$dataDir = Join-Path $projectDir 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$secHeaders = @{'User-Agent'='RICHFLOW research prototype contact@richflow.local'}
$webHeaders = @{'User-Agent'='Mozilla/5.0'}

Invoke-WebRequest -UseBasicParsing `
  -Uri 'https://www.sec.gov/files/company_tickers_exchange.json' `
  -Headers $secHeaders `
  -OutFile (Join-Path $dataDir 'sec-company-tickers-exchange.json')

Invoke-WebRequest -UseBasicParsing `
  -Uri 'https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13' `
  -Headers $webHeaders `
  -OutFile (Join-Path $dataDir 'krx-listed-companies.xls')

Invoke-WebRequest -UseBasicParsing `
  -Uri 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt' `
  -Headers $webHeaders `
  -OutFile (Join-Path $dataDir 'nasdaqlisted.txt')

Invoke-WebRequest -UseBasicParsing `
  -Uri 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt' `
  -Headers $webHeaders `
  -OutFile (Join-Path $dataDir 'otherlisted.txt')

$nasdaqHeaders = @{
  'User-Agent'='Mozilla/5.0'
  'Accept'='application/json, text/plain, */*'
  'Origin'='https://www.nasdaq.com'
  'Referer'='https://www.nasdaq.com/market-activity/stocks/screener'
}
Invoke-WebRequest -UseBasicParsing `
  -Uri 'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&download=true' `
  -Headers $nasdaqHeaders `
  -OutFile (Join-Path $dataDir 'nasdaq-stock-screener.json')

Push-Location $projectDir
try {
  node scripts/build-research-universe.mjs
} finally {
  Pop-Location
}
