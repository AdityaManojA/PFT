$mccMap = @{
    '5411' = 'Groceries'; '5499' = 'Groceries'; '5422' = 'Groceries'; '5441' = 'Groceries'; '5451' = 'Groceries'; '5462' = 'Groceries';
    '5811' = 'Dining'; '5812' = 'Dining'; '5813' = 'Dining'; '5814' = 'Dining'; '5815' = 'Dining';
    '5311' = 'Shopping'; '5331' = 'Shopping'; '5611' = 'Shopping'; '5621' = 'Shopping'; '5651' = 'Shopping';
    '5691' = 'Shopping'; '5732' = 'Shopping'; '5733' = 'Shopping'; '5941' = 'Shopping'; '5942' = 'Shopping';
    '5943' = 'Shopping'; '5944' = 'Shopping'; '5977' = 'Shopping'; '5999' = 'Shopping';
    '4111' = 'Transport'; '4112' = 'Transport'; '4121' = 'Transport'; '4131' = 'Transport'; '4789' = 'Transport';
    '5541' = 'Transport'; '5542' = 'Transport'; '7523' = 'Transport'; '7524' = 'Transport';
    '4900' = 'Utilities'; '4812' = 'Utilities'; '4814' = 'Utilities'; '4816' = 'Utilities'; '4821' = 'Utilities';
    '4899' = 'Entertainment'; '5735' = 'Entertainment'; '7832' = 'Entertainment'; '7922' = 'Entertainment';
    '5912' = 'Health'; '8011' = 'Health'; '8021' = 'Health'; '8031' = 'Health'; '8062' = 'Health';
    '6211' = 'Investments'; '6051' = 'Investments';
    '0000' = 'Transfers'; '6540' = 'Transfers'
}

function Detect-MCC($text) {
    if ($text -match '(?:[\/\s\-_]|^)(\d{4})(?:[\/\s\-_]|$)') {
        $code = $matches[1]
        if ($mccMap.ContainsKey($code)) {
            return $mccMap[$code]
        }
    }
    return $null
}

$samples = @(
    'UPIOUT/509137154876/palmtree.63468258@hdfcba/5499 TFR C93972700 220.00',
    'UPIOUT/102401983718/axisbankltdbbps.rzp@axis/4112 TFR C93999875 27.00',
    'UPIOUT/102437594497/nirunair005@okhdfcbank/U/0000 TFR S45594180 50.00',
    'UPIOUT/509146241842/gpay-11255294316@okbizax/5812 TFR S47396159 50.00',
    'UPIOUT/509248670747/q051776628@ybl/Paid via /5411 TFR S50651274 28.00',
    'UPIOUT/509250101073/vyapar.170059501032@hdfc/5812 TFR S52472581 20.00',
    'UPIOUT/509254013777/seaportcafe412@fbl/Paid /5812 TFR S57376383 46.00',
    'UPIOUT/509255815887/adnixprotvpm@ybl/Payment/5733 TFR S59424001 170.00',
    'UPIOUT/509231661165/spotify.bdsi@icici/Manda/4899 TFR S62335510 59.00',
    'UPIOUT/509361298635/pkt-9995999228@okbizaxis/7523 TFR S65317349 94.64',
    'UPIOUT/626512345678/q747985925@ybl/5411 TRF S47985925 434.39',
    'MB FTB/134208099/self TRF S47123456 488.04',
    'UPIOUT/626212345678/chai-point@icici/5812 TRF S47123999 38.04'
)

Write-Host "=== TEST PATTERN RECOGNITION ==="
foreach ($s in $samples) {
    $cat = Detect-MCC $s
    if (-not $cat) {
        if ($s -match '\b(MB\s*FTB|FTB)\b') { $cat = 'Transfers' }
        elseif ($s -match 'spotify') { $cat = 'Entertainment' }
        elseif ($s -match 'chai|coffee|cafe') { $cat = 'Dining' }
        elseif ($s -match 'q\d+@') { $cat = 'Shopping' }
        else { $cat = 'Other' }
    }
    Write-Host ("[{0,-13}] {1}" -f $cat, $s.Substring(0, [Math]::Min(65, $s.Length)))
}
