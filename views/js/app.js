var app = angular.module('fma', []);

app.constant('baseUrl','http://canisback.com:3000/');

app.filter('formatMasteryPoints', function() {
	return function(input) {
		if(input>=1000000000){
			var score = Math.floor(input/10000000)/100;
			if(input>=10000000000){
				score = Math.floor(input/100000000)/10;
			}
			
			return score+"G";
		}else 
		if(input>=1000000){
			var score = Math.floor(input/10000)/100;
			if(input>=10000000){
				score = Math.floor(input/100000)/10;
			}
			
			return score+"M";
		}else 
		if(input>=1000){
			var score = Math.floor(input/10)/100;
			if(input>=10000){
				score = Math.floor(input/100)/10;
			}
			return score+"k";
		}
		
		return input;
	};
});


app.filter('chestFilter', function () {
    return function (champion, chestOptimized) {
		
        var result = [];
        angular.forEach(champion, function (value, key) {
			if (!value.chestGranted || !chestOptimized)
				result.push(value);
        });
		return result;
		
    }
});

app.filter('sortChampions', function(){
    return function(input) {
		if(input)
			return Object.keys(input).map(function (key) {return input[key]}).sort(function(a,b){return a.name > b.name});
    }
});