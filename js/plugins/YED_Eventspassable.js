//=============================================================================
// YED_Eventspassable.js
//=============================================================================

/*:ja
 * @target MZ
 * @plugindesc イベントもしくはフォロワーが他のイベントにヒットした際に、途中で停止してしまうことを防ぎます。
 */
Game_Event.prototype.isCollidedWithEvents = function(x, y) {
    var events = $gameMap.eventsXyNt(x, y);
    return events.some(function(event) {
        return event._priorityType === this._priorityType;
    });
};
