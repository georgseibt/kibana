(function () {
    var Networkdiagram;
    Networkdiagram = window.Networkdiagram = {};



    Networkdiagram.Chart = function (_config) {
        /*
            Mandatory attributes
            ====================
            data            contains all connections which should be displayed in the network diagram. The structure of data is an array with several objects 
                            as the following:
                                {   source:   name of the node from which the connection comes
                                    target:   name of the node to which the connection goes
                                    value:    strength of the link
                                }
                            possible values: any in the above described format
            elem            is the id of a <div> in which the network diagram should be drawn
                            possible values: any valid id of a <div>

            Optional attributes
            ===================
            tooltipElem             is the id of a <div> where the tooltip should appear. If the tooltip should be movable or no
                                    tooltip should be shown, the element can remain empty
                                    default: null
                                    possible values: any valid id of a <div> or null
            charge                  is a technical attribute for the settings of the network.
                                    default: -300
                                    possible values: any number
            colorcode               defines if the nodes should be drawn in black-white or with colors
                                    default: 'colored'
                                    possible values: ['colored', 'black-white']
            colors                  is an array of different colors. These colors are used for the filling of the nodes
                                    default: a number of colors in the attribute 'default_colorset'
                                    possible values: any array of colors
            nodeSize                defines if the size of the nodes is based on the number of incoming or outgoing links.
                                    default: 'outgoing'
                                    possible values: ['outgoing', 'incoming']
            directed                defines if the network diagram should be directed (true) or undirected (false)
                                    default: true
                                    possible values: [true, false]
            tooltipSetting          defines if tooltips should be shown in case of a mouseoverevent
                                    default: 'static'
                                    possible values: ['none', 'movable', 'static']
            sortingTooltip          defines by which criteria the connections in the tooltip should be sorted
                                    default: 'source'
                                    possible values: ['source', 'target', 'data']
            sortingOrderTooltip     defines if the nodes should be ordered ascending or descending
                                    default: true
                                    possible values: [true, false] true means ascending, false means descending
            tooltipOrientation      defines if the text in the tooltip should be horizontal or vertical
                                    default: 'horizontal'
                                    possible values: ['horizontal', 'vertical']
            onClickNode             defines a function which should be executed on a click event on a node
                                    default: null
                                    possible values: any function
            onClickLink             defines a function which should be executed on a click event on a link
                                    default: null
                                    possible values: any function
        */

        var default_colorset = [
            "#8E388E", "#7171C6", "#7D9EC0", "#388E8E", "#71C671"
        ];
        var default_tooltipElem = null,
            default_charge = -300,
            default_colorcode = 'black-white',
            default_nodeSize = 'outgoing',
            default_directed = true,
            default_sortingTooltip = 'source',
            default_sortingOrderTooltip = true,
            default_tooltipSetting = true,
            default_tooltipOrientation = 'vertical';


        /*
            Initializing the attributes
        */
        var plotElem = _config.elem,
            tooltipElem = ((typeof _config.tooltipElem === 'undefined' || _config.tooltipElem === null) ? default_tooltipElem : _config.tooltipElem),
            plotWidth = $("#" + plotElem).width(),
            plotHeight = $("#" + plotElem).height(),
            charge = ((typeof _config.charge === 'undefined' || _config.charge === null) ? default_charge : _config.charge),
            colorcode = ((typeof _config.colorcode === 'undefined' || _config.colorcode === null) ? default_colorcode : _config.colorcode),
            colors = ((typeof _config.colors === 'undefined' || _config.colors === null) ? default_colorset : _config.colors.concat(default_colorset)),
            nodeSize = ((typeof _config.nodeSize === 'undefined' || _config.nodeSize === null) ? default_nodeSize : _config.nodeSize),
            directed = ((typeof _config.directed === 'undefined' || _config.directed === null) ? default_directed : _config.directed),
            sortingTooltip = ((typeof _config.sortingTooltip === 'undefined' || _config.sortingTooltip === null) ? default_sortingTooltip : _config.sortingTooltip),
            sortingOrderTooltip = ((typeof _config.sortingOrderTooltip === 'undefined' || _config.sortingOrderTooltip === null) ? default_sortingOrderTooltip : _config.sortingOrderTooltip),
            tooltipSetting = ((typeof _config.tooltipSetting === 'undefined' || _config.tooltipSetting === null) ? default_tooltipSetting : _config.tooltipSetting),
            tooltipOrientation = ((typeof _config.tooltipOrientation === 'undefined' || _config.tooltipOrientation === null) ? default_tooltipOrientation : _config.tooltipOrientation);
        
        var svg,
            force,
            arrowhead_length = 10;

        var data = prepareData(_config.data),
            nodes = data.nodes,
            links = data.links,
            linkedByIndex = data.linkedByIndex,
            maxValueOfLink = data.maxValueOfLink,
            maxOutgoingTotalOfNode = data.maxOutgoingTotalOfNode,
            maxIncomingTotalOfNode = data.maxIncomingTotalOfNode,
            maxTotalOfNode = data.maxTotalOfNode;

        //Define the required layout
        svg = d3.select('#' + plotElem)
            .append("svg")
            .attr("width", plotWidth)
            .attr("height", plotHeight);

        force = d3.layout.force()
            .gravity(0)
            .charge(charge)
            .linkDistance(200)
            .size([plotWidth, plotHeight]);

        svg.append("defs")
            .selectAll("marker")
            .data(["end"])      // Different link/path types can be defined here
            .enter()
            .append("marker")    // This section adds in the arrows
            .attr("id", String)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 10)   //defines how far the marker is away from the end of the path
            .attr("refY", 0)
            .attr("markerWidth", arrowhead_length)
            .attr("markerHeight", arrowhead_length)
            .attr("markerUnits", "userSpaceOnUse")  //this line makes the marker size independent of the path stroke-width
            .attr("orient", "auto")
            .attr("class", "networkdiagram-marker")
            .append("svg:path")
            .attr("d", "M0,-5L10,0L0,5");

        force.nodes(nodes)
            .links(links)
            .on("tick", tick)
            .start();

        // add the links and the arrows
        var path = svg.append("g").selectAll("path")
            .data(force.links())
            .enter()
            .append("path")
            .attr("class", "networkdiagram-link")
            .attr("id", function (d, i) { return "linkId_" + i; })
            .style("stroke-width", function (d) { return ((d.value - 1) / maxValueOfLink) * 5 + 1; }); //the width of the path is scaled on a scale from 1 to 5

        if (directed) {
            path.attr("marker-end", "url(#end)");
        }

        var path_invisible = svg.append("g").selectAll("path_invisible")
            .data(force.links())
            .enter()
            .append("path")
            .attr("class", "networkdiagram-link")
            .style("opacity", 0)
            .attr("id", function (d, i) { return "invisbleLinkId_" + i; })
            .style("stroke-width", 10) //the width of the path is scaled on a scale from 0 to 5
            .on("mouseover", function (d) { linkMouseover(d); })
            .on("mouseout", function (d) { linkMouseout(d); })
            .on("mousemove", function (d) { linkMouseover(d); })
            .on("click", function (d) {
                if (!d3.event.ctrlKey) { //node is only filtered if ctrl Key is NOT pressed
                    if (typeof _config.onClickLink === 'undefined' || _config.onClickLink === null) {
                        console.log("No function implemented");
                    }
                    else {
                        _config.onClickLink(d);
                    }
                }
            });

        // define the nodes
        var node = svg.selectAll(".node")
            .data(force.nodes())
            .enter()
            .append("g")
            .attr("class", "node")
            .style("fill", function (d) { if (colorcode === "black-white") { return "black"; } else { return d.color; } })
            .on("mouseover", function (d) { nodeMouseover(d); })
            .on("mouseout", function (d) { nodeMouseout(d); })
            .on("mousemove", function (d) { nodeMouseover(d); })
            .on("click", function (d) {
                if (!d3.event.ctrlKey) { //node is only filtered if ctrl Key is NOT pressed
                    if (typeof _config.onClickNode === 'undefined' || _config.onClickNode === null) {
                        console.log("No function implemented");
                    }
                    else {
                        _config.onClickNode(nodes[d.index]);
                    }
                }
            })
            .call(force.drag);

        // add the nodes
        node.append("circle")
            .attr("r", function (d) {
                if (directed) {
                    if (nodeSize === 'outgoing') { return d.outgoingTotal / maxOutgoingTotalOfNode * 10 + 5; }
                    return d.incomingTotal / maxIncomingTotalOfNode * 10 + 5;
                }
                return (d.total) / maxTotalOfNode * 10 + 5;
            })
            .style("stroke", function (d) { if (colorcode === "black-white") { return "black"; } else { return d.color; } })
            .style("stroke-width", "2px");
        // add the text 
        node.append("text")
            .attr("class", "networkdiagram-linklabel")
            .attr("x", 20)
            .attr("dy", ".35em")
            .style("font", function (d) {
                if (directed) {
                    if (nodeSize === 'outgoing') { return (12 + (d.outgoingTotal / maxOutgoingTotalOfNode * 10) + "px Arial"); }
                    return (12 + (d.incomingTotal / maxIncomingTotalOfNode * 10) + "px Arial");
                }
                return (12 + (d.total / maxTotalOfNode * 10) + "px Arial");
            })
            .text(function (d) { return d.label; });

        // add the curvy lines
        function tick() {
            path.attr("d", function (d) {
                return linkArc(d);
            });
            path_invisible.attr("d", function (d) {
                return linkArc(d);
            });
            node.attr("cx", function (d) { return d.x = Math.max(50, Math.min(plotWidth - 50, d.x)); })   //guarantees that the nodes are always 50px away from the border
                .attr("cy", function (d) { return d.y = Math.max(50, Math.min(plotHeight - 50, d.y)); }); //guarantees that the nodes are always 50px away from the border
            node.attr("transform", transform);
        }
        function isConnected(a, b) {
            return ((linkedByIndex[a.index + "," + b.index] || linkedByIndex[b.index + "," + a.index] || (a === b ? 1 : 0)) === 1);
        }
        function prepareData(data) {
            /*
                Format of the passed variable:
                    'data' is an array of multiple objects. Each object represents a link between two nodes.
                    So, each object is required to have the following structure when it is passed to this function:
                    {   source:   name of the node from which the connection comes
                        target:   name of the node to which the connection goes
                        value:    strength of the link
                    }

                Task of the function:
                    The function has several tasks to do:
                    1. Identifying unique nodes
                    2. creating an array of objects. Each object represents a link between two nodes

                Format of the return value:
                    The function returns an object with a list of the unique nodes and a list of the links. It also returns a matrix which indicates which nodes are connected, and it returns
                    several statistics about the data: 'maxValueOfLink', 'maxOutgoingTotalOfNode', 'maxIncomingTotalOfNode', 'maxTotalOfNode'
            */

            /*
                A list of all nodes without duplicates has to be created. The list consists of an object for each node with the attributes 'label', 'color', 'outgoingTotal',
                'incomingTotal', 'total', 'numberOfLinks'
            */
            var listOfNodes = [];   //just an array with the names of the nodes
            var uniqueNodes = [];   //array of objects for each node, with the attributes: 'label', 'color', 'outgoingTotal', 'incomingTotal', 'total', 'numberOfLinks'
            data.forEach(function (d) {
                listOfNodes.push(d.source);     //reading all the node names and storing them in the array "listOfNodes"
                listOfNodes.push(d.target);     //reading all the node names and storing them in the array "listOfNodes"
            });
            listOfNodes = (listOfNodes.filter(function onlyUnique(value, index, self) { return self.indexOf(value) === index; }));      //filtering the listOfNodes, so no duplicates remain

            if (colors.length < listOfNodes.length) {
                /*
                    A number of colorcodes are given at the beginning. If more colors are needed, this loop creates additional ones.
                */
                colors = colors.concat(generateColors({ "numberOfColors": listOfNodes.length }));
            }

            var count = 0;
            listOfNodes.forEach(function (node) {
                /*
                    This loop creates some statistics for the nodes. The loop sums up the values of links coming into and going out of the node, and both together.
                    It also counts the links to and from the node.
                */
                var outgoingTotal = 0,
                    incomingTotal = 0,
                    total = 0,
                    numberOfLinks = 0;
                data.forEach(function (d) {
                    if (d.source === node) {
                        outgoingTotal = outgoingTotal + d.value;        //summing up links going out of the node
                    }
                    if (d.target === node) {
                        incomingTotal = incomingTotal + d.value;        //summing up links going into the node
                    }
                    if (d.source === node || d.target === node) {
                        total = total + d.value;                        //summing up incoming and outgoing nodes from the node
                        numberOfLinks++;                                //Counting the number of links to and from the node
                    }
                });
                var object = {                          //creating an object for the node with the attributes 'label' and 'color' and its statistics
                    'label': node,
                    'color': colors[count++],
                    'outgoingTotal': outgoingTotal,
                    'incomingTotal': incomingTotal,
                    'total': total,
                    'numberOfLinks': numberOfLinks
                };
                uniqueNodes.push(object);
            });

            /*
                In the following we generate an array with objects of the links. Each object contains the information of source, target, value, and the relation as a complete name. 
                Source and target are references to the nodes.
                If the network should be drawn as an undirected network, the links are aggregated so that two links A->B and B->A are just shown as A->B
            */
            var links = [];
            var directedLinks = [];
            data.forEach(function (link) {
                var object = {
                    relation: link.source + '-' + link.target,
                    source: uniqueNodes.map(function (e) { return e.label; }).indexOf(link.source),
                    target: uniqueNodes.map(function (e) { return e.label; }).indexOf(link.target),
                    value: link.value
                };
                directedLinks.push(object);
            });
            /*
                creating a clone of the 'directedLinks' array
            */
            var undirectedLinks = [];
            directedLinks.forEach(function (d) {
                var obj = _.clone(d);
                undirectedLinks.push(obj);
            });
            if (directed) {
                //the links are not aggregated. Values for A->B and B->A stay seperate records
                links = directedLinks;
            }
            else {
                //we summarize the links, so that two relations like A->B and B->A are summarized to A->B
                undirectedLinks.forEach(function (d) {
                    if (d.source < d.target) { } else {
                        var help = d.source;
                        d.source = d.target;
                        d.target = help;
                        d.relation = uniqueNodes[d.source].label + '-' + uniqueNodes[d.target].label;
                    }
                });
                undirectedLinks.sort(function (a, b) {
                    if (a.relation < b.relation) {
                        return -1;
                    }
                    if (a.relation > b.relation) {
                        return 1;
                    }
                    return 0;
                });

                var undirectedLinks = _.chain(undirectedLinks)
                    .groupBy("relation")
                    .map(function (value, key) {
                        return {
                            "relation": key,
                            "source": _.pluck(value, "source")[0],
                            "target": _.pluck(value, "target")[0],
                            "value": _.reduce(_.pluck(value, "value"), function (memo, num) { return memo + num; }, 0)
                        };
                    })
                    .value();

                links = undirectedLinks;
            }

            /*
                In the following some statistics of the data are defined: 'maxValueOfLink', 'maxOutgoingTotalOfNode', 'maxIncomingTotalOfNode', 'maxTotalOfNode'
            */
            var maxValueOfLink = 0, maxOutgoingTotalOfNode = 0, maxIncomingTotalOfNode = 0, maxTotalOfNode = 0, linkedByIndex = {};
            links.forEach(function (link) {
                maxValueOfLink = Math.max(maxValueOfLink, link.value);
                linkedByIndex[link.source + "," + link.target] = 1;
            });
            uniqueNodes.forEach(function (node) {
                maxOutgoingTotalOfNode = Math.max(maxOutgoingTotalOfNode, node.outgoingTotal);
                maxIncomingTotalOfNode = Math.max(maxIncomingTotalOfNode, node.incomingTotal);
                maxTotalOfNode = Math.max(maxTotalOfNode, node.total);
            });

            return {
                nodes: uniqueNodes,
                links: links,
                linkedByIndex: linkedByIndex,
                maxValueOfLink: maxValueOfLink,
                maxOutgoingTotalOfNode: maxOutgoingTotalOfNode,
                maxIncomingTotalOfNode: maxIncomingTotalOfNode,
                maxTotalOfNode: maxTotalOfNode
            };

        }

        function nodeMouseover(node) {
            /*
                Format of the passed variable:
                    'node' is the information about a node

                Task of the function:
                    This function creates a tooltip if the mouse is moved over a node. The tooltip includes the name of the node and the information about the links (connections).
                    The tooltip says the source node, the target node and the value of each connection.
                    All links which are not connected with the node are hidden (fade(0.1)).

                Format of the return value:
                    The function doesn't return a value but it displays a tooltip and highlights links connected to the node.
            */

            var nodeID = node.index;
            if (tooltipSetting !== 'none') {
                var details = getDetailsOnNode(nodeID),//'details' contains a list of objects. Each object is a connection between two nodes. Each object contains the attributes 'sourceColor', 'source', 'targetColor', 'target' and 'data'. The number of objects in the array is not limited.
                    detailstext = '<h4 class=networkdiagram-h4>' + nodes[nodeID].label + '</h4>',
                    detailsList = "",
                    incomingTotal = 0,
                    outgoingTotal = 0;

                details.forEach(function (d) {
                    /*
                        In this loop the information which are passed in the array 'details' is joined to a readable html text. 
                        This text (variable 'detailstext') will be used to generate a tooltip.
                    */
                    if (d.source === nodes[nodeID].label) {
                        outgoingTotal = outgoingTotal + d.data;
                    }
                    else {
                        incomingTotal = incomingTotal + d.data;
                    }
                    detailsList = detailsList + (queryColorDot(d.sourceColor, 15) + ' ' + queryColorDot(d.targetColor, 15) + ' ' + d.source + '-' + d.target + ' (' + d.data + ')' + (tooltipOrientation === "horizontal" ? ', ' : '<br/>'));
                });
                detailstext = detailstext + "(Outgoing: " + outgoingTotal + ", Incoming: " + incomingTotal + ")<br/><br/>";
                detailstext = detailstext + detailsList;
                try {
                    //before displaying the tooltip, potentially still existing tooltips are removed
                    document.getElementById("tooltip").remove();
                } catch (error) { }

                showTooltip(100, 0.9, detailstext, d3.event.pageX + 15, d3.event.pageY);
            }

            fade(node, 0.1);    //hiding links and nodes not connected to the node the mouse is on
        }
        function nodeMouseout(node) {
            /*
                Format of the passed variable:
                    'node' is the information about a node

                Task of the function:
                    When the mouse leaves the node, the tooltip is removed and all hidden links are shown again.

                Format of the return value:
                    The function doesn't return a value but removes the tooltip and shows links again.
            */

            try {
                document.getElementById("tooltip").remove();    //removing the tooltip
            } catch (error) { }

            fade(node, 1);      //showing all nodes and links again which are connected to the node the mouse is on
        }
        function getDetailsOnNode(nodeID) {
            /*
                Format of the passed variable:
                    'nodeID' is the ID of a node for which information have to be passed.

                Task of the function:
                    This function returns an array with objects. Each object represents a connection to or from the selected node ('nodeID').
                    Each object has the following attributes: 'sourceColor', 'source' (name of the source node), 'targetColor', 'target' (name of the target node),
                    'data' (value of the connection).
                    At the end of the function the list of connections is ordered.
                    Required data are the '_config.data' (which is the data how it was passed to the library), 'nodes' (which is an array of objects, with each object
                    representing one node with the name, color, and other attributes)
                    
                Format of the return value:
                    The function returns a list of objects. Each object represents a link as describe above.
            */

            var nodeName = nodes[nodeID].label,
                links = [];

            _config.data.forEach(function (link) {
                if (link.source === nodeName || link.target === nodeName) {
                    var object = {
                        "sourceColor": nodes.filter(function (node) { return node.label === link.source; })[0].color,
                        "source": link.source,
                        "targetColor": nodes.filter(function (node) { return node.label === link.target; })[0].color,
                        "target": link.target,
                        "data": link.value
                    };
                    links.push(object);
                }
            });

            links.sort(dynamicSort(sortingTooltip, !sortingOrderTooltip));      //Here the links are sorted. The links can be sorted by any attribute of the object. It can also be reversed.
            return links;
        }

        function linkMouseover(link) {
            /*
                Format of the passed variable:
                    'link' is the information about a link

                Task of the function:
                    This function creates a tooltip if the mouse hovers over a link. The tooltip includes the information about the links (connections).
                    The tooltip says the source node, the target node and the value of the connection. If the link is 'undirected' the tooltip also 
                    aggregates the values to a total 'sum'.
                    Moreover, all other links are hidden. The links are hidden, so the user can concentrate on the link where the mouse is.

                Format of the return value:
                    The function doesn't return a value but it displays a tooltip and highlights the link.
            */

            var sourceID = link.source.index,
                targetID = link.target.index;

            if (tooltipSetting !== 'none') {
                var details = getDetailsOnChord(sourceID, targetID),   //'details' contains a list of objects. Each object is a connection between two nodes. Each object contains the attributes 'sourceColor', 'source', 'targetColor', 'target' and 'data'. The length of the array is maximum 2, because a connection between two nodes can just go from A to B or B two A.
                    detailstext = "",
                    sum = 0;

                details.forEach(function (link) {
                    /*
                        In this loop the information which are passed in the array 'details' is joined to a readable html text. 
                        This text (variable 'detailstext') will be used to generate a tooltip.
                    */
                    sum = sum + link.data;  //'sum' is the aggregation of all data (determines the value of a connection)
                    detailstext = detailstext + (queryColorDot(link.sourceColor, 15) + ' ' + queryColorDot(link.targetColor, 15) + ' ' + link.source + '-' + link.target + ' (' + link.data + ')<br/>');
                });

                if (!directed) {
                    // the 'sum' is just shown if the network diagram is undirected
                    detailstext = detailstext + 'Sum: ' + sum;
                }

                try {
                    //before displaying the tooltip, potentially still existing tooltips are removed
                    document.getElementById("tooltip").remove();
                } catch (error) { }
                showTooltip(100, 0.9, detailstext, d3.event.pageX + 15, d3.event.pageY);
            }
        }
        function linkMouseout(link) {
            /*
                Format of the passed variable:
                    'link' is the information about a link

                Task of the function:
                    When the mouse leaves the link, the tooltip is removed.

                Format of the return value:
                    The function doesn't return a value but removes the tooltip.
            */

            try {
                document.getElementById("tooltip").remove();
            } catch (error) { }
        }
        function getDetailsOnChord(sourceID, targetID) {
            /*
                Format of the passed variable:
                    'sourceID' is the ID of a node where a link starts and 'targetID' is the ID of a node where a link ends

                Task of the function:
                    This function returns an array with objects. Each object represents a connection of this link. As the link is between exactly two nodes, there
                    can be a maximum of two connections (A to B, or B to A)
                    Each object has the following attributes: 'sourceColor', 'source' (name of the source node), 'targetColor', 'target' (name of the target node),
                    'data' (value of the connection).
                    At the end of the function the list of connections is ordered.
                    Required data are the '_config.data' (which is the data how it was passed to the library), 'nodes' (which is an array of objects, with each object
                    representing one node with the name and the color)
                    
                Format of the return value:
                    The function returns a list of objects. Each object represents a link as describe above.
            */

            var sourceName = nodes[sourceID].label,
                targetName = nodes[targetID].label,
                links = [];
            if (directed) {
                _config.data.forEach(function (link) {
                    if ((link.source === sourceName && link.target === targetName)) {
                        var object = {
                            "sourceColor": nodes.filter(function (node) { return node.label === link.source; })[0].color,
                            "source": link.source,
                            "targetColor": nodes.filter(function (node) { return node.label === link.target; })[0].color,
                            "target": link.target,
                            "data": link.value
                        };
                        links.push(object);
                    }
                });
            }
            else {
                _config.data.forEach(function (link) {
                    if ((link.source === sourceName && link.target === targetName) || (link.source === targetName && link.target === sourceName)) {
                        var object = {
                            "sourceColor": nodes.filter(function (node) { return node.label === link.source; })[0].color,
                            "source": link.source,
                            "targetColor": nodes.filter(function (node) { return node.label === link.target; })[0].color,
                            "target": link.target,
                            "data": link.value
                        };
                        links.push(object);
                    }
                });
            }

            links.sort(dynamicSort(sortingTooltip, !sortingOrderTooltip));      //Here the links are sorted. The links can be sorted by any attribute of the object. It can also be reversed.
            return links;
        }

        function fade(selectedNode, opacity) {
            /*
                Format of the passed variable:
                    selectedNode: are information about one node in the form of an object
                    opacity: is a numeric value, which determines the opacity of unconnected nodes

                Task of the function:
                    This function determines if two nodes are connected or not. If the user has selected a node by moving the mouse over it 
                    (variable: selectedNode), the function checks which other nodes are connected to the selected node. 
                    This check is done by the function isConnected(). If the nodes are connected and the mouse is over the node, 
                    the node and the connection between the nodes stay visible. If the mouse is removed all connections and nodes are visible again.

                Format of the return value:
                    The function doesn't return anything but hides unconnected nodes.
            */

            node.style("stroke-opacity", function (connectedNodes) {
                var thisOpacity = isConnected(selectedNode, connectedNodes) ? 1 : opacity;
                this.setAttribute('fill-opacity', thisOpacity);
                return thisOpacity;
            });

            path.style("opacity", function (connectedNodes) {
                return (connectedNodes.source === selectedNode || connectedNodes.target === selectedNode) ? 1 : opacity;
            });
        }
        function linkArc(d) {
            /*
                Format of the passed variable:
                    'd' is the information about a link between two nodes.

                Task of the function:
                    The function calculates how to draw a link between two nodes.

                Format of the return value:
                    The function returns a string says how to draw the link between two nodes.
            */
            if (directed) {
                //if the the grapgh is directed, the links are drawn as curved lines
                var sx = d.source.x,
                    sy = d.source.y,
                    tx = d.target.x,
                    ty = d.target.y;

                var sourceNodeRadius;
                var targetNodeRadius;
                if (nodeSize === 'outgoing') {
                    sourceNodeRadius = d.source.outgoingTotal / maxOutgoingTotalOfNode * 10 + 5;
                    targetNodeRadius = d.target.outgoingTotal / maxOutgoingTotalOfNode * 10 + 5;
                }
                else {
                    sourceNodeRadius = d.source.incomingTotal / maxIncomingTotalOfNode * 10 + 5;
                    targetNodeRadius = d.target.incomingTotal / maxIncomingTotalOfNode * 10 + 5;
                }

                if (sx > tx && sy > ty) { //target top left of source
                    sx = sx - sourceNodeRadius;
                    sy = sy;
                    tx = tx;
                    ty = ty + targetNodeRadius;
                }
                if (sx < tx && sy > ty) { //target top right of source
                    sx = sx;
                    sy = sy - sourceNodeRadius;
                    tx = tx - targetNodeRadius;
                    ty = ty;
                }
                if (sx < tx && sy < ty) { //target bottom right of source
                    sx = sx + sourceNodeRadius;
                    sy = sy;
                    tx = tx;
                    ty = ty - targetNodeRadius;
                }
                if (sx > tx && sy < ty) { //target bottom left of source
                    sx = sx;
                    sy = sy + sourceNodeRadius;
                    tx = tx + targetNodeRadius;
                    ty = ty;
                }

                var dx = tx - sx,
                    dy = ty - sy,
                    dr = Math.sqrt(dx * dx + dy * dy);
                return "M" + sx + "," + sy + "A" + dr + "," + dr + " 0 0,1 " + tx + "," + ty;
            }
            else {
                //if graph is undirected, the links are drawn as straight lines
                return "M" + d.source.x + "," + d.source.y + "A" + 0 + "," + 0 + " 0 0,1 " + d.target.x + "," + d.target.y;
            }
        }
        function transform(d) {
            return "translate(" + d.x + "," + d.y + ")";
        }
        function showTooltip(duration, opacity, text, posLeft, posTop) {
            /*
                Format of the passed variable:
                    The variables give some information about the style and content of the tooltip
                    duration: says how long it takes until the tooltip appears
                    opacity: defines the opacity of the background of the tooltip
                    text: is the text shown in the tooltip
                    posLeft, posTop: indicates where the tooltip in relation to the mouse should be shown

                Task of the function:
                    This function makes the tooltip visible. The tooltip either appears as a movable box next to the mouse or fixed to a specific position.

                Format of the return value:
                    The function doesn't return a value but it displays a tooltip
            */
            var tooltip;
            if (tooltipSetting === 'movable') {
                //if the tooltip should be movable the <div> for the tooltip is created dynamically
                tooltip = d3.select("body").append("div")
                    .attr("id", "tooltip")
                    .attr("class", "networkdiagram-tooltip");
                tooltip.transition()
                    .duration(duration)
                    .style("opacity", opacity);
                tooltip.html(text)
                    .style("left", posLeft + "px")
                    .style("top", posTop + "px");
            }
            else {
                //if the tooltip should appear at a fixed position the div is created in a specific position which is defined in 'tooltipElem'
                tooltip = d3.select("#" + tooltipElem).append("div")
                    .attr("id", "tooltip")
                    .attr("class", "networkdiagram-tooltip-fix");
                tooltip.html(text);
            }
        }
        function queryColorDot(color, diameter) {
            /*
                Format of the passed variable:
                    color: the color of the dot
                    diameter: the size of the dot

                Task of the function:
                    This function creates a colored dot in html with a specific color and diameter

                Format of the return value:
                    The function returns html code for a colored dot
            */
            return '<div style="' + [
                'display:inline-block',
                'color:' + color,
                'font-size:' + diameter + 'px',
                'border-radius: 50%',
                'width:' + diameter + 'px',
                'height:' + diameter + 'px',
                'background:' + color
            ].join(';') + '"></div>';
        }
        function dynamicSort(property, reverse) {
            /*
                This function can sort an array with objects by one of its properties. It can also reverse the sorting
            */
            var sortOrder = 1;
            if (property[0] === '-') {
                sortOrder = -1;
                property = property.substr(1);
            }
            if (!reverse) {
                return function (a, b) {
                    var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
                    return result * sortOrder;
                };
            }
            else {
                return function (a, b) {
                    var result = (a[property] > b[property]) ? -1 : (a[property] < b[property]) ? 1 : 0;
                    return result * sortOrder;
                };
            }
        }

    }
}).call(this)