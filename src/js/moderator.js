'use strict';

var url = require('./url'),
  cap = require('./util').cap,
  windowOrigin = require('./util').getWindowOrigin();

var log = require('./logging').getLogger('Moderator');

var $ = jQuery,
    IFRAME_HEIGHT_DEFAULT = 300,
    players = {},
    firstPlayer = true,
    metadataList = 'pwp_metadata',
//    autoplay = url.getFragment('autoplay'),
    timerange = url.checkCurrent(); // timecode

var options; // global options

/**
 * strip hash from location
 * @param {string} location
 * @returns {string}
 */
function getIdFromLocation(location) {
  var href = location.href,
    hashPosition = href.indexOf('#'),
    to = href.length;

  if (hashPosition >= 0) {
    to = hashPosition;
  }

  return href.substring(0, to);
}

function getStaticEmbedPageSource(id) {
  if (!options.staticEmbedPage) { throw new Error('"staticEmbedPage" parameter missing.'); }
  return options.staticEmbedPage + '?' + id;
}

function getIframeReplacement() {
  /*jshint validthis:true */
  var $frame, frame, data;
  var $element = $(this);
  var source = $element.data('podlove-web-player-source');

  if (!source) {
    var elementId = $element.get(0).id;
    if (!elementId) { throw new Error('Element without source set needs an ID'); }
    source = getStaticEmbedPageSource(elementId);
    data = window[metadataList][elementId];
    if (!data) { throw new Error('No data found for "' + elementId + '"'); }
  }

  if (firstPlayer && timerange[0]) {
    firstPlayer = false;
    source += '#t=' + url.getFragment('t');
  }

  $frame = $('<iframe>', {
    src: source,
    height: IFRAME_HEIGHT_DEFAULT,
    width: '100%',
    class: 'podlove-webplayer-frame',
    css: {
      border: 'none',
      overflow: 'hidden'
    },
    scrolling: 'no'
  });

  frame = $frame.get(0);

  // register player frame
  players[frame.src] = {
    data: data,
    frame: $frame,
    state: -1
  };
  log.info('registered player with id', frame.src);

  return $frame;
}

/**
 * Pause all registered players except the one with the given ID
 * @param {String} currentPlayerId
 */
function pausePlayersExceptOne(currentPlayerId) {
  var playerData, playerId, message = {action: 'pause'};
  for (playerId in players) {
    if (playerId === currentPlayerId || !players.hasOwnProperty(playerId)) {
      continue;
    }
    playerData = players[playerId];
    if (playerData.state === 0) {
      continue;
    } // nothing to do, it is already paused

    playerData.frame.get(0).contentWindow.postMessage(message, playerId);
  }
}

/**
 * decide what to do with a received message
 * @param {jQuery.Event} event
 */
function handleMessage(event) {
  
  if (event.originalEvent.origin !== windowOrigin) {
    return;
  }
  
  // discard hash - it changes along with the time media is played
  var originalEvent = event.originalEvent,
    data = originalEvent.data,
    action = data.action,
    argumentObject = data.arg,
    id = getIdFromLocation(originalEvent.source.location),
    player = players[id];

  log.debug('received message', action, argumentObject);

  if (!player) {
    log.warn('no player found with id', id);
    return;
  }

  if (action === null || argumentObject === null) {
    log.warn('no action or data was given');
    return;
  }

  log.debug('received', action, 'from', id, 'with', argumentObject);

  if (action === 'waiting') {
    player.frame.get(0).contentWindow.postMessage({playerOptions: player.data}, windowOrigin);
  }

  if (action === 'ready' || action === 'pause') {
    player.state = 0;
  }

  if (action === 'play') {
    player.state = 1;
    pausePlayersExceptOne(id);
  }

}

// receive messages from embedded players
$(window).on('message', handleMessage);

/**
 * Replace selection of nodes with embedded podlove webplayers and register them internally
 * @param {object} opts
 * @returns {jQuery} jQuery extended HTMLIFrameElement
 */
$.fn.podlovewebplayer = function (opts) {
  options = opts || {};
  return this.replaceWith(getIframeReplacement);
};

window.pwp = {
  players: players
};