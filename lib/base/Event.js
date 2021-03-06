/**
 * @author Vladimir Kozhin <affka@affka.ru>
 * @license MIT
 */

'use strict';

/**
 * @namespace Jii
 * @ignore
 */
var Jii = require('../Jii');

require('./Object');

/**
 * @class Jii.base.Event
 * @extends Jii.base.Object
 */
Jii.defineClass('Jii.base.Event', /** @lends Jii.base.Event.prototype */{

	__extends: Jii.base.Object,

	/**
	 * @var {string} the event name. This property is set by [[Jii.base.Component.trigger()]] and [[trigger()]].
	 * Event handlers may use this property to check what event it is handling.
	 */
	name: null,

	/**
	 * @var {object} the sender of this event. If not set, this property will be
	 * set as the object whose "trigger()" method is called.
	 * This property may also be a `null` when this event is a
	 * class-level event which is triggered in a static context.
	 */
	sender: null,

	/**
	 * @var {boolean} whether the event is handled. Defaults to false.
	 * When a handler sets this to be true, the event processing will stop and
	 * ignore the rest of the uninvoked event handlers.
	 */
	handled: false,

	/**
	 * @var {*} the data that is passed to [[Jii.base.Component.on()]] when attaching an event handler.
	 * Note that this varies according to which event handler is currently executing.
	 */
	data: null,

	params: {},

	__static: /** @lends Jii.base.Event */{

		/**
		 * Convert string/function/object to object handler with context and callback params
		 * @param {string|function|object|[]} handler
		 * @param {object} [context]
		 * @returns {*}
		 */
		normalizeHandler: function (handler, context) {
			context = context || null;

			if (Jii._.isObject(handler) && Jii._.has(handler, 'callback') && Jii._.has(handler, 'context')) {
				return handler;
			}

			if (Jii._.isArray(handler) && handler.length === 2) {
				if (Jii._.isFunction(handler[0]) && Jii._.isObject(handler[1])) {
					return {
						context: handler[1],
						callback: handler[0]
					};
				}

				if (Jii._.isString(handler[0])) {
					handler[0] = Jii.namespace(handler[0]);
				}
				return {
					context: handler[0],
					callback: handler[0][handler[1]]
				};
			}

			if (Jii._.isString(handler)) {
				return {
					context: context,
					callback: this[handler]
				};
			}

			if (Jii._.isFunction(handler)) {
				return {
					context: context,
					callback: handler
				};
			}

			throw new Jii.exceptions.ApplicationException('Wrong handler format:' + JSON.stringify(handler));
		},

		_events: {},

		/**
		 * Attaches an event handler to a class-level event.
		 *
		 * When a class-level event is triggered, event handlers attached
		 * to that class and all parent classes will be invoked.
		 *
		 * For example, the following code attaches an event handler to `ActiveRecord`'s
		 * `afterInsert` event:
		 *
		 * ~~~
		 * Jii.base.Event.on(ActiveRecord.className(), ActiveRecord.EVENT_AFTER_INSERT, function (event) {
		 *     console.log(event.sender.className() + ' is inserted.');
		 * });
		 * ~~~
		 *
		 * The handler will be invoked for EVERY successful ActiveRecord insertion.
		 *
		 * For more details about how to declare an event handler, please refer to [[Jii.base.Component.on()]].
		 *
		 * @param {string} className the fully qualified class name to which the event handler needs to attach.
		 * @param {string} name the event name.
		 * @param {string|function|object} handler the event handler.
		 * @param {*} [data] the data to be passed to the event handler when the event is triggered.
		 * When the event handler is invoked, this data can be accessed via [[Jii.base.Event.data]].
		 * @param {boolean} [isAppend] whether to append new event handler to the end of the existing
		 * handler list. If false, the new handler will be inserted at the beginning of the existing
		 * handler list.
		 * @see off()
		 */
		on: function (className, name, handler, data, isAppend) {
			data = data || null;
			isAppend = Jii._.isUndefined(isAppend) ? true : isAppend;

			if (isAppend || !this._events || !this._events[name] || !this._events[name][className]) {
				this._events = this._events || {};
				this._events[name] = this._events[name] || {};
				this._events[name][className] = this._events[name][className] || [];
				this._events[name][className].push([handler, data]);
			} else {
				this._events[name].unshift([handler, data]);
			}
		},

		/**
		 * Detaches an event handler from a class-level event.
		 *
		 * This method is the opposite of [[on()]].
		 *
		 * @param {string} className the fully qualified class name from which the event handler needs to be detached.
		 * @param {string} name the event name.
		 * @param {string|function|object} [handler] the event handler to be removed.
		 * If it is null, all handlers attached to the named event will be removed.
		 * @return boolean whether a handler is found and detached.
		 * @see on()
		 */
		off: function (className, name, handler) {
			handler = handler || null;

			if (!this._events || !this._events[name] || !this._events[name][className]) {
				return false;
			}

			if (handler === null) {
				delete this._events[name][className];
				return true;
			}

			var newEvents = [];
			var isRemoved = false;
			Jii._.each(this._events[name][className], Jii._.bind(function(event) {
				if (event[0] !== handler) {
					newEvents.push(event);
				} else {
					isRemoved = true;
				}
			}, this));
			if (newEvents.length === 0) {
				delete this._events[name][className];
			} else {
				this._events[name][className] = newEvents;
			}

			return isRemoved;
		},

		/**
		 * Returns a value indicating whether there is any handler attached to the specified class-level event.
		 * Note that this method will also check all parent classes to see if there is any handler attached
		 * to the named event.
		 * @param {string|object} className the object or the fully qualified class name specifying the class-level event.
		 * @param {string} name the event name.
		 * @return boolean whether there is any handler attached to the event.
		 */
		hasHandlers: function (className, name) {
			if (!this._events || !this._events[name]) {
				return false;
			}

			if (Jii._.isObject(className)) {
				className = className.className();
			}

			var currentClass = Jii._.isObject(className) ? className : Jii.namespace(className);
			while (true) {
				if (this._events[name][className]) {
					return true;
				}

				className = currentClass.parentClassName();
				currentClass = className ? Jii.namespace(className) : null;

				if (!currentClass) {
					break;
				}
			}

			return false;
		},

		/**
		 * Triggers a class-level event.
		 * This method will cause invocation of event handlers that are attached to the named event
		 * for the specified class and all its parent classes.
		 * @param {string|object} className the object or the fully qualified class name specifying the class-level event.
		 * @param {string} name the event name.
		 * @param {Jii.base.Event} [event] the event parameter. If not set, a default [[Event]] object will be created.
		 */
		trigger: function (className, name, event) {
			event = event || null;

			if (!this._events || !this._events[name]) {
				return;
			}

			if (event === null) {
				event = new this();
			}
			
			event.handled = false;
			event.name = name;

			if (Jii._.isObject(className)) {
				if (event.sender === null) {
					event.sender = className;
				}
				className = className.className();
			}

			var currentClass = Jii._.isObject(className) ? className : Jii.namespace(className);
			while (true) {
				if (this._events[name][className]) {
					for (var handler, i = 0, l = this._events[name][className].length; i < l; i++) {
						handler = this._events[name][className][i];

						event.data = handler[1];
						handler[0] = this.normalizeHandler(handler[0]);
						handler[0].callback.call(handler[0].context, event);

						if (event.handled) {
							return;
						}
					}
				}

				className = currentClass.parentClassName();
				currentClass = className ? Jii.namespace(className) : null;

				if (!currentClass) {
					break;
				}
			}
		}
	}

});
