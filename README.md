FullMastery Alchemist
=====================

This is my entry for the Riot API Challenge April 2016 : https://developer.riotgames.com/discussion/announcements/show/eoq3tZd1


## Presentation

The goal of this Riot API Challenge is to work with the champion mastery API.

The application allows to create rooms which can be shared between players, giving them a collaborative board permanently up-to-date, thanks to websocket.

The purpose of the application is to suggest players the best line-up, considering their champion mastery points and highest grade.

The users may be able to use different filters to modify the suggestions to what they need : 

 - Champion : select the champions to dismiss from the user suggestions
 
 - Position : select the lane to dismiss from the user suggestions
 
 - Bans : select the champions to dismiss from the global suggestions (ex: champions ban in draft mode)
 
 - Chest optimization : dismiss the champions that already won a Hextech chest this season
 
 - Lock champion/position : select a specific champion/position ignoring suggestion and adapting other users suggestions.
 
[Live demo](http://canisback.com:3000)
 
 
## How to use

The application runs on NodeJS, so you will need it.

The application requires also LeagueJS wrapper : https://github.com/claudiowilson/LeagueJS

As of May 2016, the wrapper was not up to date with the champion mastery API, so I included the files I changed to handle champion mastery API.

You will need to add your API key on top of `fma.js`.

You will need to change the base url of the angular app in the `views/js/app.js`.

You will need to change path to resources in the `views/fma.html`.