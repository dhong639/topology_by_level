class Graph {
	constructor(edges, root) {
		this.root = root
		this.edges = {}
		this.graph = {}
		for(var edge_id in edges) {
			this.edges[edge_id] = edges[edge_id]
			var source = edges[edge_id][0]
			var target = edges[edge_id][1]
			if(source in this.graph == false) {
				this.graph[source] = {}
			}
			if(target in this.graph == false) {
				this.graph[target] = {}
			}
			this.graph[source][target] = edge_id
			this.graph[target][source] = edge_id
		}
		this.levels = {}
		this.links_intra = {}
		this.links_child = {}
		this.links_parent = {}
		this.breadthFirst_byLevel()
		this.assign_links()
		this.counter_domain = 1000
		this.domains = {}
		this.assign_domains()
	}
	has_edge(node_a, node_b) {
		return node_b in this.graph[node_a] && node_a in this.graph[node_b]
	}
	get_neighbors(node) {
		var neighbors = []
		for(var neighbor in this.graph[node]) {
			var edge_id = this.graph[node][neighbor]
			if(this.edges[edge_id][2] == true) {
				neighbors.push(neighbor)
			}
		}
		return neighbors
	}
	get_nodes() {
		return Object.keys(this.graph)
	}
	get_edges() {
		return Object.keys(this.edges)
	}
	get_domains() {
		return Object.keys(this.domains)
	}
	change_edgeDirection(edge_id) {
		var source = this.edges[edge_id][0]
		var target = this.edges[edge_id][1]
		this.edges[edge_id][0] = target
		this.edges[edge_id][1] = source
	}
	get_segment(start) {
		/**
		 * a segment begins at some starting node
		 * all children of a previous parent are part of the segment
		 * includes endpoints of direct horizontal links from child in either direction
		 * function can only run if all reachability matrices are set
		 */
		var visited = new Set([start])
		var level_curr = new Set([start])
		var level_next = new Set()
		/**
		 * by definition, a segment must have children
		 * if the starting point of the segment has no children, it's segment is itself
		 */
		while(level_curr.size != 0) {
			/**
			 * parents are all the previous children and any nodes on the same level
			 * do not calculate intra-level links for children
			 * for each parent, get children in links_child
			 * once again, links are not edges 
			 * - links are strictly from parent to child
			 * - edges are bidirectional
			 * this traversal uses levels instead of graph because links are not edges
			 */
			level_curr.forEach(source => {
				visited.add(source)
				this.get_nodesChild(source).forEach(target => {
					level_next.add(target)
				})
			})
			/**
			 * copy over next to current and search until no more next values
			 */
			level_curr.clear()
			level_next.forEach(node => {
				level_curr.add(node)
			})
			level_next.clear()
		}
		return visited
	}
	get_nodesIntra(node) {
		var set_intra = new Set()
		var level = this.levels[node]
		if(node in this.links_intra[level]) {
			this.links_intra[level][node].forEach(edge_id => {
				var west = this.edges[edge_id][0]
				var east = this.edges[edge_id][1]
				if(west != node) {
					set_intra.add(west)
				}
				if(east != node) {
					set_intra.add(east)
				}
			})
		}
		return set_intra
	}
	get_nodesChild(source) {
		var set_child = new Set()
		var level = this.levels[source]
		if(source in this.links_child[level]) {
			this.links_child[level][source].forEach(edge_id => {
				var target = this.edges[edge_id][1]
				set_child.add(target)
			})
		}
		return set_child
	}
	get_nodesParent(target) {
		var set_parent = new Set()
		var level = this.levels[target]
		if(target in this.links_parent[level]) {
			this.links_parent[level][target].forEach(edge_id => {
				var source = this.edges[edge_id][0]
				set_parent.add(source)
			})
		}
		return set_parent
	}
	assign_domains() {
		this.domains = {}
		var unions = {}
		var segments = {}
		/**
		 * determine parent of each node in the segment
		 */
		for(var child in this.graph[this.root]) {
			unions[child] = new Set([child])
			this.get_segment(child).forEach(node => {
				segments[node] = child
			})
		}
		/**
		 * determine which segments are connected to one another
		 * connections are transitive; AB and BC implies AC
		 * found by finding horizontal and parent links 
		 * between segments and using set unions on segment roots
		 */
		for(var west in segments) {
			var parent_west = segments[west]
			this.get_nodesIntra(west).forEach(east => {
				var parent_east = segments[east]
				var union = new Set([...unions[parent_west], ...unions[parent_east]])
				union.forEach(parent => {
					unions[parent].clear()
					union.forEach(node => {
						unions[parent].add(node)
					})
				})
			})
		}
		for(var child in segments) {
			var parent_child = segments[child]
			if(parent_child != child) {
				this.get_nodesParent(child).forEach(parent => {
					var parent_parent = segments[parent]
					var union = new Set([...unions[parent_child], ...unions[parent_parent]])
					union.forEach(parent => {
						unions[parent].clear()
						union.forEach(node => {
							unions[parent].add(node)
						})
					})
				})
			}
		}
		/**
		 * create arbitrary domain IDs and assign to them nodes in segments
		 * avoid duplicates, each parent traversed only once
		 */
		var visited = new Set()
		for(var union in unions) {
			var domain = new Set()
			unions[union].forEach(parent => {
				if(visited.has(parent) == false) {
					this.get_segment(parent).forEach(child => {
						domain.add(child)
						visited.add(child)
					})
				}
			})
			if(domain.size != 0) {
				this.domains[this.counter_domain++] = domain
			}
		}

	}
	breadthFirst_byLevel() {
		/**
		 * run breadth-first algorithm to determine levels for all other nodes in segment
		 * parents will be assigned levels in the current level
		 * children will be assigned levels in the next level
		 * skip nodes traversed in previous section
		 * only nodes within segment can be traversed
		 */
		var visited = new Set()
		var level_curr = 0
		var nodes_curr = new Set([this.root])
		var level_next = level_curr + 1
		var nodes_next = new Set()
		while(nodes_curr.size > 0) {
			/**
			 * add levels to matrices if not already there
			 * it is intended that some levels remain completely empty
			 */
			var dicts = [this.links_intra, this.links_child, this.links_parent]
			dicts.forEach(dict => {
				if(level_curr in dict == false) {
					dict[level_curr] = {}
				}
			})
			/**
			 * visit nodes in nodes_curr first
			 * prevents lookup from going into previous layers
			 * don't assign levels for nodes already connected to a parent
			 */
			nodes_curr.forEach(node => {
				this.levels[node] = level_curr
				visited.add(node)
			})
			nodes_curr.forEach(source => {
				for(var target in this.graph[source]) {
					/**
					 * only visit nodes that are in the segment
					 * do not visit nodes if they were previously in nodes_curr
					 * do not visit nodes assigned by the parameter "parents"
					 */
					if(visited.has(target) == false) {
						nodes_next.add(target)
					}
				}
			})
			nodes_curr.clear()
			nodes_next.forEach(node => {
				nodes_curr.add(node)
				nodes_next.delete(node)
			})
			level_curr = level_next
			level_next += 1
		}
	}
	assign_links() {
		var visited = new Set()
		var level = this.levels[this.root]
		var nodes_curr = new Set([this.root])
		var nodes_next = new Set()
		while(nodes_curr.size > 0) {
			nodes_curr.forEach(source => {
				for(var target in this.graph[source]) {
					/**
					 * avoid adding targets that are not directly below current level
					 * children are below the source, parents are above the source
					 * note that Python does not let a set change size during operation
					 * Python uses while loop and the pop function to remove an item from a set
					 * avoid child/parent links
					 */
					if(this.levels[target] != level + 1) {
						visited.add(target)
					}
					if(visited.has(target) == false) {
						/**
						 * when the graph is recalculated, edges may not match expected direction
						 * swap parent/child direction of link if needed
						 * for this scenario, source is the parent, and target is the child
						 */
						var edge_id = this.graph[source][target]
						if(source != this.edges[edge_id][0] && target != this.edges[edge_id][1]) {
							this.change_edgeDirection(edge_id)
						}
						/**
						 * add a child link to the parent
						 * don't if the child was included via segments/parents
						 */
						if(source in this.links_child[level] == false) {
						this.links_child[level][source] = new Set()
						}
						this.links_child[level][source].add(edge_id)
						/**
						 * add a parent link to the child
						 * don't if the child was included via segments/parents
						 */
						if(target in this.links_parent[level + 1] == false) {
							this.links_parent[level + 1][target] = new Set()
						}
						this.links_parent[level + 1][target].add(edge_id)
						/**
						 * add child to nodes_next, used in next block
						 */
						nodes_next.add(target)
					}
				}
			})
			/**
			 * find intra-level links in the child nodes
			 * child nodes are in nodes_next, note the levels
			 * since the root is always one node, it is not necessary to search nodes_curr
			 */
			nodes_next.forEach(source => {
				for(var target in this.graph[source]) {
					if(nodes_next.has(target) && this.levels[source] == this.levels[target]) {
						var edge_id = this.graph[source][target]
						/**
						 * get item on the left
						 * horizontal directions aren't real, no need to orient direction
						 * ignore nodes included via segments/parents
						 */
						var west = this.edges[edge_id][0]
						if(west in this.links_intra[level + 1] == false) {
							this.links_intra[level + 1][west] = new Set()
						}
						this.links_intra[level + 1][west].add(edge_id)
						/**
						 * get item on the right
						 * horizontal directions aren't real, no need to orient direction
						 * ignore nodes included via segments/parents
						 */
						var east = this.edges[edge_id][1]
						if(east in this.links_intra[level + 1] == false) {
							this.links_intra[level + 1][east] = new Set()
						}
						this.links_intra[level + 1][east].add(edge_id)
					}
				}
			})
			nodes_curr.clear()
			nodes_next.forEach(node => {
				nodes_curr.add(node)
			})
			nodes_next.clear()
			level += 1
		}
	}
	remove_edge(node_a, node_b) {
		var level_a = this.levels[node_a]
		var level_b = this.levels[node_b]
		var parents_b = this.get_nodesParent(node_b)
		/**
		 * note that the graph is bidirectional
		 * in theory, this should work would both ways
		 */
		var edge_id = this.graph[node_a][node_b]
		/**
		 * determine all connections from removed segment to rest of graph
		 * if there are no possible parents, do not remove link
		 * instead, set link as "unreachable"
		 */
		var parents = new Set()
		var segment = this.get_segment(node_b)
		segment.forEach(child => {
			this.get_nodesIntra(child).forEach(parent => {
				if(segment.has(parent) == false && parent != node_a) {
					parents.add(parent)
				}
			})
			this.get_nodesParent(child).forEach(parent => {
				if(segment.has(parent) == false && parent != node_a) {
					parents.add(parent)
				}
			})
		})
		if(parents.size == 0) {
			console.log()
			this.edges[edge_id][2] = false
		}
		else {
			/**
			 * remove connection
			 */
			delete this.graph[node_a][node_b]
			delete this.graph[node_b][node_a]
			delete this.edges[edge_id]
			/**
			 * first, check whether or not it's necessary to recalculate for a segment
			 * if target has another parent on previous level, don't recalculate
			 * if source and target are on the same level, don't recalculate
			 * note that rules for parent/child level assignment still apply
			 * note that this step has no reason to involve anchors (segment still reachable)
			 */
			if(level_a == level_b || parents_b.size > 1) {
				/**
				 * remove from intra-level, if possible
				 * note that east and west are not used for traversal
				 * this links will be stored in both directions
				 * remove source node IDs to avoid traversal issues
				 */
				if(level_a in this.links_intra && node_a in this.links_intra[level_a]) {
					this.links_intra[level_a][node_a].delete(edge_id)
					if(this.links_intra[level_a][node_a].size == 0) {
						delete this.links_intra[level_a][node_a]
					}
				}
				if(level_b in this.links_intra && node_b in this.links_intra[level_b]) {
					this.links_intra[level_b][node_b].delete(edge_id)
					if(this.links_intra[level_b][node_b].size == 0) {
						delete this.links_intra[level_b][node_b]
					}
				}
				/**
				 * remove from parent and child, if possible
				 * node_a is the parent, and node_b is the child
				 * as with before, remove node key from level if it points to an empty set
				 * remove source node IDs to avoid traversal issues
				 */
				if(level_a in this.links_child && node_a in this.links_child[level_a]) {
					this.links_child[level_a][node_a].delete(edge_id)
					if(this.links_child[level_a][node_a].size == 0) {
						delete this.links_child[level_a][node_a]
					}
				}
				if(level_b in this.links_parent && node_b in this.links_parent[level_b]) {
					this.links_parent[level_b][node_b].delete(edge_id)
					if(this.links_parent[level_b][node_b].size == 0) {
						delete this.links_parent[level_b][node_b]
					}
				}
				/**
				 * it is still necessary to assign domains
				 */
				this.assign_domains()
			}
			else {
				/**
				 * completely reset all rechability matrices
				 */
				this.levels = {}
				this.links_intra = {}
				this.links_child = {}
				this.links_parent = {}
				/**
				 * assign new levels, links, and domains
				 */
				this.breadthFirst_byLevel()
				this.assign_links()
				this.assign_domains()
			}
		}
	}
	insert_edge(edge_id, node_a, node_b) {
		var has_linkA = node_a in this.graph && node_b in this.graph[node_a]
		var has_linkB = node_b in this.graph && node_a in this.graph[node_b]
		if(has_linkA && has_linkB) {
			/**
			 * some edges, when removed, were instead set as "unreachable"
			 * unreachable edges still exist for link traversal and assignment
			 * in this situation, don't set a new link, just enable an existing one
			 */
			var edge_id = this.graph[node_a][node_b]
			if(this.edges[edge_id][2] == false) {
				this.edges[edge_id][2] = true
			}
		}
		else {
			var level_a = this.levels[node_a]
			var level_b = this.levels[node_b]
			/**
			 * regardless, add edge to graph
			 */
			this.edges[edge_id] = [node_a, node_b, true]
			if(node_a in this.graph == false) {
				this.graph[node_a] = {}
			}
			this.graph[node_a][node_b] = edge_id
			if(node_b in this.graph == false) {
				this.graph[node_b] = {}
			}
			this.graph[node_b][node_a] = edge_id
			/**
			 * adding edge between nodes on same level is trivial
			 */
			if(level_a == level_b) {
				console.log('intra-level')
				/**
				 * add edge to western node
				 */
				if(node_a in this.links_intra[level_a] == false) {
					this.links_intra[level_a][node_a] = new Set()
				}
				this.links_intra[level_a][node_a].add(edge_id)
				/**
				 * add edge to eastern node
				 */
				if(node_b in this.links_intra[level_b] == false) {
					this.links_intra[level_b][node_b] = new Set()
				}
				this.links_intra[level_b][node_b] = new Set()
			}
			/**
			 * adding edge between nodes on adjacent levels is trivial
			 * adding edge to new node is trivial (new node always below existing node)
			 */
			else if(Math.abs(level_a - level_b) == 1) {
				/**
				 * add edge to parent
				 */
				if(node_a in this.links_child[level_a] == false) {
					this.links_child[level_a][node_a] = new Set()
				}
				this.links_child[level_a][node_a].add(edge_id)
				/**
				 * add edge to child
				 */
				if(node_b in this.links_parent[level_b] == false) {
					this.links_parent[level_b][node_b] = new Set()
				}
				this.links_parent[level_b][node_b].add(edge_id)
			}
			/**
			 * if two nodes are not on adjacent levels, recalculate levels
			 */
			else{
				/**
				 * completely reset all rechability matrices
				 */
				 this.levels = {}
				 this.links_intra = {}
				 this.links_child = {}
				 this.links_parent = {}
				 /**
				  * assign new levels, links, and domains
				  */
				 this.breadthFirst_byLevel()
				 this.assign_links()
				 this.assign_domains()
			}
		}
	}
	OLD_breadthFirst_byLevel(start=this.root, level_start=0, segment=null, parents=null) {
		/**
		 * segment represents some subsection of the network under a given node
		 * edges represents all the edges to be assigned
		 * parents is any existing node in the graph with a link that should be kept
		 * if the three above are null, this is a new graph
		 * if the three above are sets, recalculate for graph subsection only
		 */
		if(segment == null && parents == null) {
			segment = new Set(this.get_nodes())
			parents = new Set()
		}
		/**
		 * some nodes have connections to parents that need to be preserved
		 * the resulting links will always be vertical
		 * the child will always be one level lower than the parent
		 * no need to calculate levels for these nodes later on
		 */
		var ignore = new Set()
		parents.forEach(parent => {
			for(var child in this.graph[parent]) {
				if(segment.has(child) == true) {
					this.levels[child] = this.levels[parent] + 1
					ignore.add(child)
				}
			}
		})
		/**
		 * run breadth-first algorithm to determine levels for all other nodes in segment
		 * parents will be assigned levels in the current level
		 * children will be assigned levels in the next level
		 * skip nodes traversed in previous section
		 * only nodes within segment can be traversed
		 */
		var visited = new Set()
		var level_curr = level_start
		var nodes_curr = new Set([start])
		var level_next = level_curr + 1
		var nodes_next = new Set()
		while(nodes_curr.size > 0) {
			/**
			 * add levels to matrices if not already there
			 * it is intended that some levels remain completely empty
			 */
			var dicts = [this.links_intra, this.links_child, this.links_parent]
			dicts.forEach(dict => {
				if(level_curr in dict == false) {
					dict[level_curr] = {}
				}
			})
			/**
			 * visit nodes in nodes_curr first
			 * prevents lookup from going into previous layers
			 * don't assign levels for nodes already connected to a parent
			 */
			nodes_curr.forEach(node => {
				if(ignore.has(node) == false) {
					this.levels[node] = level_curr
				}
				visited.add(node)
			})
			nodes_curr.forEach(source => {
				for(var target in this.graph[source]) {
					/**
					 * only visit nodes that are in the segment
					 * do not visit nodes if they were previously in nodes_curr
					 * do not visit nodes assigned by the parameter "parents"
					 */
					if(segment.has(target) == true && visited.has(target) == false) {
						nodes_next.add(target)
					}
				}
			})
			nodes_curr.clear()
			nodes_next.forEach(node => {
				nodes_curr.add(node)
				nodes_next.delete(node)
			})
			level_curr = level_next
			level_next += 1
		}
	}
	OLD_assign_links(start=this.root, segment=null, parents=null) {
		/**
		 * segment represents some subsection of the network under a given node
		 * edges represents all the edges to be assigned
		 * parents is any existing node in the graph with a link that should be kept
		 * if the three above are null, this is a new graph
		 * if the three above are sets, recalculate for graph subsection only
		 */
		 if(segment == null && parents == null) {
			segment = new Set(this.get_nodes())
			parents = new Set()
		}
		/**
		 * some nodes have connections to parents that need to be preserved
		 * the resulting links will always be vertical
		 * the child will always be one level lower than the parent
		 * no need to calculate levels for these edges later on
		 */
		var ignore = new Set()
		segment.forEach(child => {
			var anchors = new Set()
			var level_anchor = Infinity
			var level_child = this.levels[child]
			var horizontal = new Set()
			parents.forEach(parent => {
				if(parent in this.graph[child] && child in this.graph[parent]) {
					var level_parent = this.levels[parent]
					if(level_parent <= level_child) {
						horizontal.add(parent)
						if(level_parent < level_anchor) {
							level_anchor = level_parent
							anchors.forEach(anchor => {
								horizontal.add(anchor)
							})
							anchors.clear()
						}
						if(level_parent == level_anchor) {
							horizontal.delete(parent)
							anchors.add(parent)
						}
					}
				}
			})
			anchors.forEach(anchor => {
				var level = this.levels[anchor]
				var edge_id = this.graph[anchor][child]
				if(anchor in this.links_child[level] == false) {
					this.links_child[level][anchor] = new Set()
				}
				this.links_child[level][anchor].add(edge_id)
				if(child in this.links_parent[level + 1] == false) {
					this.links_parent[level + 1][child] = new Set()
				}
				this.links_parent[level + 1][child].add(edge_id)
				ignore.add(edge_id)
			})
			horizontal.forEach(parent => {
				var level = this.levels[parent]
				var edge_id = this.graph[parent][child]
				if(parent in this.links_intra[level] == false) {
					this.links_intra[level][parent] = new Set()
				}
				this.links_intra[level][parent].add(edge_id)
				if(child in this.links_intra[level] == false) {
					this.links_intra[level][child] = new Set()
				}
				this.links_intra[level][parent].add(edge_id)
				ignore.add(edge_id)
			})
		})
		var visited = new Set()
		var level = this.levels[start]
		var nodes_curr = new Set([start])
		var nodes_next = new Set()
		while(nodes_curr.size > 0) {
			nodes_curr.forEach(source => {
				for(var target in this.graph[source]) {
					/**
					 * avoid adding targets that are not directly below current level
					 * children are below the source, parents are above the source
					 * note that Python does not let a set change size during operation
					 * Python uses while loop and the pop function to remove an item from a set
					 * avoid child/parent links
					 */
					if(this.levels[target] != level + 1) {
						visited.add(target)
					}
					if(visited.has(target) == false) {
						/**
						 * when the graph is recalculated, edges may not match expected direction
						 * swap parent/child direction of link if needed
						 * for this scenario, source is the parent, and target is the child
						 */
						var edge_id = this.graph[source][target]
						if(source != this.edges[edge_id][0] && target != this.edges[edge_id][1]) {
							this.change_edgeDirection(edge_id)
						}
						//if(ignore.has(source) == false && ignore.has(target) == false) {
						if(ignore.has(edge_id) == false) {
							/**
							 * add a child link to the parent
							 * don't if the child was included via segments/parents
							 */
							if(source in this.links_child[level] == false) {
								this.links_child[level][source] = new Set()
							}
							this.links_child[level][source].add(edge_id)
							/**
							 * add a parent link to the child
							 * don't if the child was included via segments/parents
							 */
							if(target in this.links_parent[level + 1] == false) {
								this.links_parent[level + 1][target] = new Set()
							}
							this.links_parent[level + 1][target].add(edge_id)
						}
						/**
						 * add child to nodes_next, used in next block
						 */
						nodes_next.add(target)
					}
				}
			})
			/**
			 * find intra-level links in the child nodes
			 * child nodes are in nodes_next, note the levels
			 * since the root is always one node, it is not necessary to search nodes_curr
			 */
			nodes_next.forEach(source => {
				for(var target in this.graph[source]) {
					if(nodes_next.has(target) && this.levels[source] == this.levels[target]) {
						/**
						 * get edge
						 */
						var edge_id = this.graph[source][target]
						
						if(ignore.has(edge_id) == false) {
							/**
							 * get item on the left
							 * horizontal directions aren't real, no need to orient direction
							 * ignore nodes included via segments/parents
							 */
							var west = this.edges[edge_id][0]
							if(ignore.has(west) == false) {
								if(west in this.links_intra[level + 1] == false) {
									this.links_intra[level + 1][west] = new Set()
								}
								this.links_intra[level + 1][west].add(edge_id)
							}
							/**
							 * get item on the right
							 * horizontal directions aren't real, no need to orient direction
							 * ignore nodes included via segments/parents
							 */
							var east = this.edges[edge_id][1]
							if(ignore.has(east) == false) {
								if(east in this.links_intra[level + 1] == false) {
									this.links_intra[level + 1][east] = new Set()
								}
								this.links_intra[level + 1][east].add(edge_id)
							}
						}
					}
				}
			})
			nodes_curr.clear()
			nodes_next.forEach(node => {
				nodes_curr.add(node)
			})
			nodes_next.clear()
			level += 1
		}
	}
	OLD_remove_edge(node_a, node_b) {
		var edges_affected = new Set()
		/**
		 * first, check whether or not it's necessary to recalculate for a segment
		 * if target has another parent on previous level, don't recalculate
		 * if source and target are on the same level, don't recalculate
		 * note that rules for parent/child level assignment still apply
		 * note that this step has no reason to involve anchors (segment still reachable)
		 */
		if(this.levels[node_a] == this.levels[node_b] || this.get_nodesParent(node_b).size > 1) {
			/**
			 * because no further calculations are made,
			 * levels of a and b do not change
			 */
			var level_a = this.levels[node_a]
			var level_b = this.levels[node_b]
			/**
			 * note that the graph is bidirectional
			 * in theory, this should work would both ways
			 */
			var edge_id = this.graph[node_a][node_b]
			/**
			 * remove connection
			 */
			delete this.graph[node_a][node_b]
			delete this.graph[node_b][node_a]
			delete this.edges[edge_id]
			/**
			 * remove from intra-level, if possible
			 * note that east and west are not used for traversal
			 * this links will be stored in both directions
			 * remove source node IDs to avoid traversal issues
			 */
			if(level_a in this.links_intra && node_a in this.links_intra[level_a]) {
				this.links_intra[level_a][node_a].delete(edge_id)
				if(this.links_intra[level_a][node_a].size == 0) {
					delete this.links_intra[level_a][node_a]
				}
			}
			if(level_b in this.links_intra && node_b in this.links_intra[level_b]) {
				this.links_intra[level_b][node_b].delete(edge_id)
				if(this.links_intra[level_b][node_b].size == 0) {
					delete this.links_intra[level_b][node_b]
				}
			}
			/**
			 * remove from parent and child, if possible
			 * node_a is the parent, and node_b is the child
			 * as with before, remove node key from level if it points to an empty set
			 * remove source node IDs to avoid traversal issues
			 */
			if(level_a in this.links_child && node_a in this.links_child[level_a]) {
				this.links_child[level_a][node_a].delete(edge_id)
				if(this.links_child[level_a][node_a].size == 0) {
					delete this.links_child[level_a][node_a]
				}
			}
			if(level_b in this.links_parent && node_b in this.links_parent[level_b]) {
				this.links_parent[level_b][node_b].delete(edge_id)
				if(this.links_parent[level_b][node_b].size == 0) {
					delete this.links_parent[level_b][node_b]
				}
			}
			/**
			 * it is still necessary to assign domains
			 */
			this.assign_domains()
			/**
			 * do not continue with rest of function
			 * return the only edge that was changed
			 */
			edges_affected.add(edge_id)
			return edges_affected
		}
		/**
		 * next step is to look for anchors
		 * an anchor refers to the highest possible parent reachable by any node in segment
		 * all other parents are also preserved
		 * new subtree is will use every connection to these parents
		 */
		var segment = this.get_segment(node_b)
		var anchor = null
		var level_anchor = Infinity
		var preserved_parents = new Set()
		segment.forEach(child => {
			var lists = [this.get_nodesParent(child), this.get_nodesIntra(child)]
			lists.forEach(list => {
				list.forEach(parent => {
					var level = this.levels[parent]
					if(segment.has(parent) == false && parent != node_a) {
						preserved_parents.add(parent)
						if(level < level_anchor) {
							anchor = parent
							level_anchor = level
						}
					}
				})
			})
		})
		/**
		 * the presence of an anchor denotes connectivity with the rest of the graph
		 * the anchor is also a preserved parent
		 * if no anchor is found, the segment is no longer connected with the graph
		 * in this scenario, do not recalculate the graph
		 * instead, set the edge_id to false, which will disable the edge
		 * when a edge is disabled, it is still shown but has no functionality
		 * it will otherwise be considered for recalculation as normal
		 * nothing will be returned
		 */
		if(anchor == null) {
			/**
			 * in this scenario, edges_affected will be empty
			 * an empty set is returned for the sake of consistency
			 */
			var edge_id = this.graph[node_a][node_b]
			this.edges[edge_id][2] = false
			return edges_affected
		}
		/**
		 * at this point, a full recalculation is required
		 * when performing the recalculation, remember the following:
		 * - preserve all nodes in segment
		 * - preserve all existing edges between segment
		 * - preserve all edges between segment and rest of graph
		 * the standard rules for level determination apply:
		 * - children are directly connected to parents and one level beneath
		 * - parents of nodes on the same level are also on the same level
		 */
		var dicts = [this.links_intra, this.links_child, this.links_parent]
		dicts.forEach(dict => {
			for(var level in dict) {
				for(var source in dict[level]) {
					dict[level][source].forEach(edge_id => {
						var edge = this.edges[edge_id]
						if(segment.has(edge[0]) || segment.has(edge[1])) {
							dict[level][source].delete(edge_id)
						}
					})
					if(dict[level][source].size == 0) {
						delete dict[level][source]
					}
				}
			}
		})
		/**
		 * remove levels from affected segment
		 */
		segment.forEach(node => {
			this.levels[node] = null
		})
		/**
		 * remove edge as a connection
		 */
		var edge_id = this.graph[node_a][node_b]
		delete this.graph[node_a][node_b]
		delete this.graph[node_b][node_a]
		delete this.edges[edge_id]
		/**
		 * assign new levels, links, and domains
		 */
		this.breadthFirst_byLevel(anchor, level_anchor, segment, preserved_parents)
		this.assign_links(anchor, segment, preserved_parents)
		this.assign_domains()
	}
}

exports.Graph = Graph