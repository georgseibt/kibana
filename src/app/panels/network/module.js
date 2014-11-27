/** @scratch /panels/5
 *
 * include::panels/network.asciidoc[]
 */

/** @scratch /panels/network/0
 *
 * == network
 * Status: *Stable*
 *
 * A network based on the results of an Elasticsearch term facet.
 *
 */

define([
    'angular',
    'app',
    'lodash',
    'jquery',
    'kbn'],

    function (angular, app, _, $, kbn) {

        'use strict';

        var module = angular.module('kibana.panels.network', []);
        app.useModule(module);

        module.controller('network', function ($scope, querySrv, dashboard, filterSrv, fields) {
            //in this function all the magic happens

            $scope.panelMeta = {
                modals: [
                    {
                        description: "Inspect",
                        icon: "icon-info-sign",
                        partial: "app/partials/inspector.html",
                        show: $scope.panel.spyable
                    }
                ],
                editorTabs: [
                    {
                        title: 'Queries',
                        src: 'app/partials/querySelect.html'
                    }
                ],
                status: "Stable",
                description: "Displays the results of an elasticsearch facet as a network diagram"
            };

            // Set and populate defaults
            var _d = {
                /** @scratch /panels/chord/5
                * sourceField:: The source field on which to computer the facet
                */
                sourceField: '_type',
                /** @scratch /panels/chord/5
                * size1:: Show this many terms for field 1
                */
                size1: 10,
                /** @scratch /panels/chord/5
                * targetField:: The target field on which to computer the facet
                */
                targetField: '_type',
                /** @scratch /panels/chord/5
                * size2:: Show this many terms for field 2
                */
                size2: 10,
                /** @scratch /panels/network/5
                * order:: How the terms are sorted: count, term, reverse_count or reverse_term, before they are filtered
                */
                order   : 'count',
                /** @scratch /panels/network/5
                * exclude:: terms to exclude from the results
                */
                exclude: [],
                /** @scratch /panels/network/5
                * charge:: defines the charge for the forced layout network
                */
                charge: -300,
                /** @scratch /panels/network/5
                * counter_pos:: The location of the legend in respect to the diagram: above, below, or none.
                */
                counter_pos: 'above',
                /** @scratch /panels/network/5
                * arrangement:: Arrangement of the legend: horizontal or vertical
                */
                arrangement : 'horizontal',
                /** @scratch /panels/network/5
                * colorcode:: Indicates if the nodes should be coloured or black-white
                */
                colorcode: 'colored',
                /** @scratch /panels/network/5
                * nodeSize:: Indicates if the size of the nodes (radius) should be proportional to the incoming, outgoing ot total number of edges
                */
                nodeSize: 'outgoing',
                /** @scratch /panels/network/5
                * directed:: defines if the paths in the network should be directed (true) or undirected (false)
                */
                directed: true,
                /** @scratch /panels/network/5
                * tooltipSetting:: Indicates if tooltips should be shown if the user hovers over a segment or chord
                */
                tooltipSetting: 'movable',
                /** @scratch /panels/network/5
                * sortingTooltip:: defines by which criteria the connections in the tooltip should be sorted
                */
                sortingTooltip: 'source',
                /** @scratch /panels/network/5
                * sortingOrderTooltip:: defines if the nodes should be ordered ascending (true) or descending (false)
                */
                sortingOrderTooltip: true,
                /** @scratch /panels/network/5
                * tooltipOrientation:: defines if the nodes should be ordered ascending or descending
                */
                tooltipOrientation: 'vertical',
                /** @scratch /panels/network/5
                * spyable:: Set spyable to false to disable the inspect button
                */
                spyable     : true,
                /** @scratch /panels/network/5
                *
                * ==== Queries
                * queries object:: This object describes the queries to use on this panel.
                * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
                * queries.ids::: In +selected+ mode, which query ids are selected.
                */
                queries     : {
                    mode        : 'all',
                    ids         : []
                }
            };

            _.defaults($scope.panel, _d);

            $scope.init = function () {
                $scope.hits = 0;    //This is just executed when the page is first started
                $scope.$on('refresh', function () {
                    //this part of the code is executed if the refresh symbol in the header is clicked
                    $scope.get_data();
                });
                $scope.get_data();  //This is executed when the page is started
            };

            $scope.get_data = function () {
                // Make sure we have everything for the request to complete
                if (dashboard.indices.length === 0) {
                    return;
                }
                $scope.panelMeta.loading = true;
                var request,
                    results,
                    boolQuery,
                    queries,
                    request1,
                    results1;

                request = $scope.ejs.Request().indices(dashboard.indices);

                $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
                queries = querySrv.getQueryObjs($scope.panel.queries.ids);

                // This could probably be changed to a BoolFilter
                boolQuery = $scope.ejs.BoolQuery();
                _.each(queries, function (q) {
                    boolQuery = boolQuery.should(querySrv.toEjsObj(q));
                });
                /*
                Different parts of the request are sticked together: from where the data should be,
                different filters and queries, etc.
                This is saved in the variable 'request'
                */

                request1 = $scope.ejs.Request().indices(dashboard.indices);
                request1 = request1
                    .facet(
                        $scope.ejs.TermsFacet('terms')
                            .field($scope.panel.sourceField)
                            .size($scope.panel.size1)
                            .order($scope.panel.order)
                            .exclude($scope.panel.exclude)
                            .facetFilter(
                                $scope.ejs.AndFilter(
                                    [
                                        $scope.ejs.QueryFilter(
                                            $scope.ejs.FilteredQuery(
                                                boolQuery,
                                                filterSrv.getBoolFilter(filterSrv.ids())
                                            )
                                        )
                                    ]
                                )
                            )
                    )
                    .size(0);
                results1 = request1.doSearch().then(function (results1) {
                    var singleNodes = [];

                    _.each(results1.facets.terms.terms, function (v) {
                        singleNodes.push(v.term);
                    });
                    if (singleNodes.length === 0) {
                        /*if no terms are in 'singleNodes' we have to make sure that the request is not empty, so we create an alibi request here*/
                        request = request
                            .facet(
                                $scope.ejs.TermsFacet('terms')
                                    .field($scope.panel.targetField)
                                    .size($scope.panel.size2)
                                    .order($scope.panel.order)
                                    .exclude($scope.panel.exclude)
                                    .facetFilter(
                                        $scope.ejs.AndFilter(
                                            [
                                                $scope.ejs.QueryFilter(
                                                    $scope.ejs.FilteredQuery(
                                                        boolQuery,
                                                        filterSrv.getBoolFilter(filterSrv.ids())
                                                    )
                                                )
                                            ]
                                        )
                                    )
                            )
                            .size(0);
                    }
                    else {
                        singleNodes.forEach(function (sourceNode) {
                            request = request
                                .facet(
                                    $scope.ejs.TermsFacet(sourceNode)
                                        .field($scope.panel.targetField)
                                        .size($scope.panel.size2)
                                        .order($scope.panel.order)
                                        .exclude($scope.panel.exclude)
                                        .facetFilter(
                                            $scope.ejs.AndFilter(
                                                [
                                                    $scope.ejs.QueryFilter(
                                                        $scope.ejs.FilteredQuery(
                                                            boolQuery,
                                                            filterSrv.getBoolFilter(filterSrv.ids())
                                                        )
                                                    ),
                                                    $scope.ejs.QueryFilter(
                                                        $scope.ejs.TermQuery(
                                                            $scope.panel.sourceField,
                                                            sourceNode
                                                        )
                                                    )
                                                ]
                                            )
                                        )
                                )
                                .size(0);
                        });
                    }

                    // Populate the inspector panel; The current request will be shown in the inspector panel
                    $scope.inspector = angular.toJson(JSON.parse(request.toString()), true);

                    // Populate scope when we have results
                    results = request.doSearch().then(function (results) {
                        $scope.panelMeta.loading = false;
                        $scope.hits = results.hits.total;

                        $scope.results = results;
                        $scope.$emit('render'); //dispatches the event upwards through the scope hierarchy of controllers.
                    });
                });
            };

            $scope.build_search = function (nodeName) {
                //This function filters the result. If you click on a node (border segment of the circle), just the Connections to and from this node are shown
                var queryterm = "";
                if (queryterm === "") {
                    queryterm = queryterm + '' + $scope.panel.sourceField + ':\"' + nodeName + '\"' + ' OR ' + $scope.panel.targetField + ':\"' + nodeName + '\"';
                }
                else {
                    queryterm = queryterm + ' OR ' + $scope.panel.sourceField + ':\"' + nodeName + '\"' + ' OR ' + $scope.panel.targetField + ':\"' + nodeName + '\"';
                }
                filterSrv.set({
                    type: 'querystring',
                    query: queryterm,
                    mandate: 'must'
                });
            };

            $scope.set_refresh = function (state) {
                //This function is executed if some changes are done in the editor
                $scope.refresh = state;
            };

            $scope.close_edit = function () {
                //This function is executed if the editor is closed
                //The data are loaded again
                if ($scope.refresh) {
                    $scope.get_data();
                }
                $scope.refresh = false;
                $scope.$emit('render');
            };
        });

        module.directive('networkChart', function (querySrv) {
            return {
                restrict: 'A',
                link: function (scope, elem) {

                    // Receive render events
                    scope.$on('render', function () {
                        render_panel(elem);
                    });

                    // Function for rendering panel
                    function render_panel(elem) {
                        var chartData;

                        build_results();

                        // IE doesn't work without this
                        elem.css({ height: scope.panel.height || scope.row.height });

                        // Make a clone we can operate on.
                        chartData = _.clone(scope.data);

                        createNetworkDiagram(scope, chartData, elem);
                    }

                    function build_results() {
                        var k = 0;
                        //the result data (the data how we need them to draw the chord diagram are now saved in the array 'scope.data'
                        scope.data = [];

                        Object.keys(scope.results.facets).forEach(function (sourceNode) {
                            _.each(scope.results.facets[sourceNode].terms, function (v) {
                                var slice;
                                slice = {
                                    source: sourceNode,
                                    target: v.term,
                                    data: v.count,
                                    color: querySrv.colors[k]
                                };

                                scope.data.push(slice);
                                k = k + 1;
                            });
                        });
                    }
                }
            };

            function createNetworkDiagram(scope, dataset, elem) {
                $(elem[0]).empty();  //removes all elements from the current element
                d3.select(elem[0]).append('div')
                    .attr("class", "network-panel")
                    .attr("id", "networkpanel-" + elem[0].id);

                var data = prepareData(dataset);

                new Networkdiagram.Chart({
                    //Mandatory
                    "elem": "networkpanel-" + elem[0].id,     //id of the just created div
                    "data": data,
                    //Optional
                    "tooltipElem": "tooltip-" + elem[0].id,
                    "charge": scope.panel.charge,
                    "colorcode": scope.panel.colorcode,                         //possible values: ['colored', 'black-white']
                    "colors": null,
                    "nodeSize": scope.panel.nodeSize,                           //possible values: ['outgoing', 'incoming']
                    "directed": scope.panel.directed,                           //possible values: [true, false] true means directed, false means undirected
                    "sortingTooltip": scope.panel.sortingTooltip,               //possible values: [label, color, outgoingTotal, incominTotal, total, numberOfLinks]
                    "sortingOrderTooltip": scope.panel.sortingOrderTooltip,     //possible values: [true, false] true means ascending, false means descending
                    "tooltipSetting": scope.panel.tooltipSetting,
                    "tooltipOrientation": scope.panel.tooltipOrientation,
                    "onClickNode": function (d) {
                        if (!d3.event.ctrlKey) { //node is only filtered if ctrl Key is NOT pressed
                            scope.build_search(d.label);
                        }
                    },
                    "onClickLink": null
                });

                function prepareData(dataset) {
                    var newData = [];

                    dataset.forEach(function (link) {
                        var object = {
                            source: link.source,
                            target: link.target,
                            value: link.data
                        };
                        newData.push(object);
                    });

                    return newData;
                }
            }
        });
    }
);