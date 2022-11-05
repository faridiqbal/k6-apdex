import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

//k6 run stages.js

export const options = {
    stages: [
        { duration: '1m', target: 500 },
        { duration: '3m', target: 500 },
        { duration: '1m', target: 0 },
    ],
};

var apdex_satisfied = new Counter('apdex_satisfied');
var apdex_tolerate = new Counter('apdex_tolerate');

export default function () {
    const res = http.get('http://test.k6.io');
    check(res, { 'status was 200': (r) => r.status == 200 });
    
    //collect APDEX performance
    if (res.timings.duration <= 2000) apdex_satisfied.add(1);
    else if (res.timings.duration <= 8000) apdex_tolerate.add(1);
    else {
        apdex_satisfied.add(0);
        apdex_tolerate.add(0);
    }
    
    sleep(1);
}

export function handleSummary(data) {
    var satisfied = data.metrics.apdex_satisfied.values.count;
    var tolerate = data.metrics.apdex_tolerate.values.count;
    var total_req = data.metrics.http_reqs.values.count;
    
    //calculate apdex score
    const apdex_score = ((satisfied + (tolerate / 2)) / total_req);
    
    //categorize apdex score
    var apdex_result = '';
    if (apdex_score < 0.5) apdex_result = 'Unacceptable';
    else if (apdex_score < 0.7) apdex_result = 'Poor';
    else if (apdex_score < 0.85) apdex_result = 'Fair';
    else if (apdex_score < 0.94) apdex_result = 'Good';
    else apdex_result = 'Excellent';

    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }) +
        '\n' +
        '\nAPDEX Score: ' + apdex_score +
        '\nAPDEX Result: ' + apdex_result +
        '\n\n'
    };
    
}
